import { PLATFORM_ID } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import {
  COCKTAILDB_TIMEOUT_MS,
  cocktailDbTimeoutInterceptor,
  isCocktailDbRequest,
  isRequestTimeout,
} from './cocktaildb-timeout.interceptor';

const DRINK_URL =
  'https://www.thecocktaildb.com/api/json/v1/1/lookup.php?i=11007';

let controller: HttpTestingController | undefined;

function setUp(platform: 'browser' | 'server') {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([cocktailDbTimeoutInterceptor])),
      provideHttpClientTesting(),
      { provide: PLATFORM_ID, useValue: platform },
    ],
  });
  controller = TestBed.inject(HttpTestingController);
  return { http: TestBed.inject(HttpClient), controller };
}

/** Subscribes and records what happens. */
function watch(http: HttpClient, url: string) {
  const result: { value?: unknown; error?: unknown } = {};
  http.get(url).subscribe({
    next: value => (result.value = value),
    error: error => (result.error = error),
  });
  return result;
}

describe('cocktailDbTimeoutInterceptor', () => {
  afterEach(() => {
    controller?.verify();
    controller = undefined;
  });

  it('only recognises TheCocktailDB', () => {
    expect(isCocktailDbRequest(DRINK_URL)).toBeTrue();
    expect(isCocktailDbRequest('/api/ingredients/interpret')).toBeFalse();
    expect(
      isCocktailDbRequest('http://localhost:4200/api/ingredients/interpret')
    ).toBeFalse();
    expect(
      isCocktailDbRequest(
        'https://firestore.googleapis.com/v1/projects/x/databases'
      )
    ).toBeFalse();
    expect(
      isCocktailDbRequest('https://www.thecocktaildb.com.example.org/')
    ).toBeFalse();
  });

  it('gives up after 15 seconds in the browser', fakeAsync(() => {
    const { http, controller } = setUp('browser');
    const result = watch(http, DRINK_URL);
    const request = controller.expectOne(DRINK_URL);

    tick(COCKTAILDB_TIMEOUT_MS.browser - 1);
    expect(result.error).toBeUndefined();
    tick(1);
    expect(isRequestTimeout(result.error)).toBeTrue();
    expect(request.cancelled).toBeTrue();
  }));

  it('gives up sooner while rendering on the server', fakeAsync(() => {
    const { http, controller } = setUp('server');
    const result = watch(http, DRINK_URL);
    const request = controller.expectOne(DRINK_URL);

    tick(COCKTAILDB_TIMEOUT_MS.server);
    expect(isRequestTimeout(result.error)).toBeTrue();
    expect(request.cancelled).toBeTrue();
  }));

  it('passes a prompt answer through unchanged', fakeAsync(() => {
    const { http, controller } = setUp('browser');
    const result = watch(http, DRINK_URL);
    const body = { drinks: [{ idDrink: '11007' }] };

    tick(1_000);
    controller.expectOne(DRINK_URL).flush(body);
    tick(COCKTAILDB_TIMEOUT_MS.browser);
    expect(result.value).toEqual(body);
    expect(result.error).toBeUndefined();
  }));

  it('leaves real HTTP errors as they are', fakeAsync(() => {
    const { http, controller } = setUp('browser');
    const result = watch(http, DRINK_URL);

    controller
      .expectOne(DRINK_URL)
      .flush('down', { status: 503, statusText: 'Unavailable' });
    expect(isRequestTimeout(result.error)).toBeFalse();
    expect((result.error as { status: number }).status).toBe(503);
  }));

  it('never times out our own /api routes', fakeAsync(() => {
    const { http, controller } = setUp('server');
    const url = '/api/ingredients/interpret/status';
    const result = watch(http, url);

    tick(60_000);
    expect(result.error).toBeUndefined();
    controller.expectOne(url).flush({ available: true });
    expect(result.value).toEqual({ available: true });
  }));

  it('never times out other hosts', fakeAsync(() => {
    const { http, controller } = setUp('browser');
    const url = 'https://example.org/slow';
    const result = watch(http, url);

    tick(60_000);
    expect(result.error).toBeUndefined();
    controller.expectOne(url).flush({});
  }));
});
