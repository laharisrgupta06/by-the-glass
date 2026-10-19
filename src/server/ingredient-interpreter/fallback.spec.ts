import {
  GenerateBusyError,
  GenerateConfigError,
  GenerateQuotaError,
  GenerateTimeoutError,
  ModelMissingError,
} from './errors';
import { CallModel, FallbackOptions, generateWithFallback } from './fallback';
import { COOLDOWN_MS, ModelPool, modelList } from './model-pool';

describe('model fallback', () => {
  let now: number;
  let options: FallbackOptions;
  const models = ['primary', 'fallback'];

  beforeEach(() => {
    now = 0;
    options = {
      attemptTimeoutMs: 25_000,
      totalTimeoutMs: 45_000,
      minAttemptMs: 10_000,
      now: () => now,
    };
  });

  /** A fake Gemini: each model answers or throws as scripted, and calls are counted. */
  function fake(script: Record<string, () => string | Error>) {
    const calls: string[] = [];
    const call: CallModel = async (model, timeoutMs) => {
      calls.push(`${model}@${timeoutMs}`);
      const result = script[model]();
      if (result instanceof Error) throw result;
      return result;
    };
    return { call, calls };
  }

  it('uses the primary model when it answers', async () => {
    const pool = new ModelPool(models, () => now);
    const { call, calls } = fake({ primary: () => 'ok', fallback: () => 'no' });
    expect(await generateWithFallback(pool, call, options)).toEqual({
      text: 'ok',
      model: 'primary',
    });
    expect(calls).toEqual(['primary@25000']);
  });

  it('moves to the fallback when the primary is overloaded, then skips the primary while it cools down', async () => {
    const pool = new ModelPool(models, () => now);
    const { call, calls } = fake({
      primary: () => new GenerateBusyError(60),
      fallback: () => 'answer',
    });
    expect((await generateWithFallback(pool, call, options)).model).toBe(
      'fallback'
    );
    // A second question within the cooldown doesn't spend quota on the overloaded model.
    await generateWithFallback(pool, call, options);
    expect(calls.map(c => c.split('@')[0])).toEqual([
      'primary',
      'fallback',
      'fallback',
    ]);
    // After the cooldown the primary is tried again.
    now += COOLDOWN_MS.overloaded;
    await generateWithFallback(pool, call, options);
    expect(calls.map(c => c.split('@')[0])).toEqual([
      'primary',
      'fallback',
      'fallback',
      'primary', // cooled down, so tried again (still overloaded here)
      'fallback',
    ]);
  });

  it('fails fast as busy, without calling Gemini, while every model cools down', async () => {
    const pool = new ModelPool(models, () => now);
    const { call, calls } = fake({
      primary: () => new GenerateBusyError(60),
      fallback: () => new GenerateBusyError(60),
    });
    await expectAsync(
      generateWithFallback(pool, call, options)
    ).toBeRejectedWith(jasmine.any(GenerateBusyError));
    expect(calls.length).toBe(2);
    now += 5_000;
    const error = await generateWithFallback(pool, call, options).catch(e => e);
    expect(error).toEqual(jasmine.any(GenerateBusyError));
    expect(error.retryAfter).toBe(55);
    expect(calls.length).toBe(2);
  });

  it('skips a retired model for good and tries the next', async () => {
    const pool = new ModelPool(models, () => now);
    const log = jasmine.createSpy('log');
    const { call, calls } = fake({
      primary: () => new ModelMissingError('primary'),
      fallback: () => 'answer',
    });
    expect(
      (await generateWithFallback(pool, call, { ...options, log })).model
    ).toBe('fallback');
    expect(log).toHaveBeenCalledWith(
      jasmine.stringContaining('primary is not available')
    );
    await generateWithFallback(pool, call, options);
    expect(calls.map(c => c.split('@')[0])).toEqual([
      'primary',
      'fallback',
      'fallback',
    ]);
  });

  it('reports a configuration problem when no configured model exists', async () => {
    const pool = new ModelPool(models, () => now);
    pool.report('primary', 'missing');
    pool.report('fallback', 'missing');
    const { call, calls } = fake({ primary: () => 'x', fallback: () => 'x' });
    await expectAsync(
      generateWithFallback(pool, call, options)
    ).toBeRejectedWith(jasmine.any(GenerateConfigError));
    expect(calls).toEqual([]);
  });

  it('stops at once on a bad key or invalid request: another model would not help', async () => {
    const pool = new ModelPool(models, () => now);
    const { call, calls } = fake({
      primary: () => new GenerateConfigError(),
      fallback: () => 'x',
    });
    await expectAsync(
      generateWithFallback(pool, call, options)
    ).toBeRejectedWith(jasmine.any(GenerateConfigError));
    expect(calls.length).toBe(1);
  });

  it('reports quota when every model is over quota, with the wait', async () => {
    const pool = new ModelPool(models, () => now);
    const { call } = fake({
      primary: () => new GenerateQuotaError(51),
      fallback: () => new GenerateQuotaError(90),
    });
    const error = await generateWithFallback(pool, call, options).catch(e => e);
    expect(error).toEqual(jasmine.any(GenerateQuotaError));
    expect(error.retryAfter).toBe(60);
  });

  it('keeps reporting quota, not busy, while every model waits out its quota', async () => {
    const pool = new ModelPool(models, () => now);
    const { call, calls } = fake({
      primary: () => new GenerateQuotaError(70_000),
      fallback: () => new GenerateQuotaError(70_000),
    });
    await generateWithFallback(pool, call, options).catch(() => undefined);
    now += 5_000;
    const error = await generateWithFallback(pool, call, options).catch(e => e);
    expect(error).toEqual(jasmine.any(GenerateQuotaError));
    expect(error.retryAfter).toBe(69_995);
    // No request is sent while the quota is known to be used up.
    expect(calls.length).toBe(2);
  });

  it('reports busy when a model is only overloaded, even if another is over quota', async () => {
    const pool = new ModelPool(models, () => now);
    const { call } = fake({
      primary: () => new GenerateQuotaError(70_000),
      fallback: () => new GenerateBusyError(60),
    });
    await generateWithFallback(pool, call, options).catch(() => undefined);
    const error = await generateWithFallback(pool, call, options).catch(e => e);
    expect(error).toEqual(jasmine.any(GenerateBusyError));
    expect(error.retryAfter).toBe(60);
  });

  it('reports a timeout, and never starts an attempt with less than the minimum time left', async () => {
    const pool = new ModelPool(['a', 'b', 'c'], () => now);
    const calls: string[] = [];
    const call: CallModel = async (model, timeoutMs) => {
      calls.push(`${model}@${timeoutMs}`);
      now += timeoutMs; // each attempt uses its whole deadline
      throw new GenerateTimeoutError();
    };
    await expectAsync(
      generateWithFallback(pool, call, options)
    ).toBeRejectedWith(jasmine.any(GenerateTimeoutError));
    // 25 s, then the 20 s left; nothing for the third model.
    expect(calls).toEqual(['a@25000', 'b@20000']);
  });

  it('passes unexpected errors through untouched', async () => {
    const pool = new ModelPool(models, () => now);
    const network = new TypeError('fetch failed');
    const { call } = fake({ primary: () => network, fallback: () => 'x' });
    await expectAsync(
      generateWithFallback(pool, call, options)
    ).toBeRejectedWith(network);
  });

  it('builds the model list from the settings, without repeats', () => {
    expect(
      modelList(
        'gemini-flash-latest',
        'gemini-3.5-flash, gemini-flash-latest ,'
      )
    ).toEqual(['gemini-flash-latest', 'gemini-3.5-flash']);
    expect(modelList('only', '')).toEqual(['only']);
  });
});
