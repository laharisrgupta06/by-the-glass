import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { INTERPRET_PATHS } from 'src/app/core/ai/ingredient-interpretation';
import { IngredientInterpreterService } from './ingredient-interpreter.service';

describe('IngredientInterpreterService', () => {
  let service: IngredientInterpreterService;
  let http: HttpTestingController;
  const vocabulary = ['Coconut milk', 'Lime'];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(IngredientInterpreterService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('switches on only when the server says so, checking once', () => {
    service.checkAvailability();
    service.checkAvailability();
    http.expectOne(INTERPRET_PATHS.status).flush({ available: true });
    expect(service.available()).toBeTrue();
  });

  it('stays off when the server has no key or no API at all', () => {
    service.checkAvailability();
    http
      .expectOne(INTERPRET_PATHS.status)
      .flush('Not found', { status: 404, statusText: 'Not Found' });
    expect(service.available()).toBeFalse();
  });

  it('posts the term and vocabulary, re-checks the answer, and caches it', () => {
    let result: unknown;
    service.interpret('Mogu Mogu', vocabulary).subscribe(r => (result = r));
    const req = http.expectOne(INTERPRET_PATHS.interpret);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ term: 'Mogu Mogu', vocabulary });
    req.flush({
      term: 'Mogu Mogu',
      summary: 'A coconut jelly drink.',
      suggestions: [
        { ingredient: 'Nata de coco', relation: 'same', reason: 'x' },
        { ingredient: 'Coconut milk', relation: 'similar', reason: 'Coconut.' },
      ],
    });
    expect(result).toEqual({
      term: 'Mogu Mogu',
      summary: 'A coconut jelly drink.',
      suggestions: [
        { ingredient: 'Coconut milk', relation: 'similar', reason: 'Coconut.' },
      ],
    });
    service.interpret('mogu mogu ', vocabulary).subscribe();
    http.expectNone(INTERPRET_PATHS.interpret);
  });

  it('reads the server’s error code and Retry-After, and only switches off for "unavailable"', () => {
    const failures: unknown[] = [];
    service.available.set(true);
    const ask = (
      term: string,
      body: object,
      status: number,
      headers: Record<string, string> = {}
    ) => {
      service
        .interpret(term, vocabulary)
        .subscribe({ error: e => failures.push(e) });
      http
        .expectOne(INTERPRET_PATHS.interpret)
        .flush(body, { status, statusText: 'x', headers });
    };
    ask('a', { error: 'busy' }, 503, { 'Retry-After': '55' });
    ask('b', { error: 'quota' }, 429, { 'Retry-After': '51' });
    ask('c', { error: 'rate-limited' }, 429, { 'Retry-After': '30' });
    ask('d', { error: 'timeout' }, 504);
    ask('e', { error: 'misconfigured' }, 500);
    ask('f', { error: 'upstream-error' }, 502);
    expect(service.available()).toBeTrue();
    ask('g', { error: 'unavailable' }, 503);
    expect(failures).toEqual([
      { code: 'busy', retryAfter: 55 },
      { code: 'quota', retryAfter: 51 },
      { code: 'rate-limited', retryAfter: 30 },
      { code: 'timeout', retryAfter: undefined },
      { code: 'misconfigured', retryAfter: undefined },
      { code: 'failed' },
      { code: 'unavailable', retryAfter: undefined },
    ]);
    expect(service.available()).toBeFalse();
  });

  it('says the API is unreachable when the server or dev proxy answers without our JSON', () => {
    const failures: unknown[] = [];
    service
      .interpret('a', vocabulary)
      .subscribe({ error: e => failures.push(e) });
    http
      .expectOne(INTERPRET_PATHS.interpret)
      .error(new ProgressEvent('error'), { status: 0, statusText: '' });
    service
      .interpret('b', vocabulary)
      .subscribe({ error: e => failures.push(e) });
    http
      .expectOne(INTERPRET_PATHS.interpret)
      .flush('Error occurred while trying to proxy', {
        status: 504,
        statusText: 'Gateway Timeout',
      });
    service
      .interpret('c', vocabulary)
      .subscribe({ error: e => failures.push(e) });
    http
      .expectOne(INTERPRET_PATHS.interpret)
      .flush('nope', { status: 404, statusText: 'Not Found' });
    expect(failures).toEqual([
      { code: 'offline' },
      { code: 'offline' },
      { code: 'failed' },
    ]);
  });
});
