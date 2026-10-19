import {
  GenerateBusyError,
  GenerateConfigError,
  GenerateQuotaError,
  GenerateTimeoutError,
  ModelMissingError,
} from './errors';
import { ModelPool } from './model-pool';

/** One request to one model, within `timeoutMs`. Throws the errors in ./errors. */
export type CallModel = (model: string, timeoutMs: number) => Promise<string>;

export interface FallbackOptions {
  attemptTimeoutMs: number;
  totalTimeoutMs: number;
  /** Don't start an attempt with less time than this left (Google's minimum deadline). */
  minAttemptMs: number;
  now?: () => number;
  log?: (message: string) => void;
}

/**
 * Tries each available model once, in order. Overloaded, timed-out, over-quota and
 * missing models are put on cooldown and skipped; a configuration error stops at once.
 * When every model is cooling down, fails fast without calling Gemini at all.
 */
export async function generateWithFallback(
  pool: ModelPool,
  call: CallModel,
  options: FallbackOptions
): Promise<{ text: string; model: string }> {
  const now = options.now ?? Date.now;
  const log = options.log ?? (() => undefined);
  const start = now();
  const candidates = pool.available();
  if (!candidates.length) {
    if (!pool.hasUsable())
      throw new GenerateConfigError(
        'None of the configured Gemini models exist.'
      );
    // Say which: a used-up quota needs a long wait, an overload usually doesn't.
    throw pool.onlyQuotaLeft()
      ? new GenerateQuotaError(pool.nextRetryIn())
      : new GenerateBusyError(pool.nextRetryIn());
  }

  const failures: ('busy' | 'quota' | 'timeout')[] = [];
  for (const model of candidates) {
    const remaining = options.totalTimeoutMs - (now() - start);
    if (remaining < options.minAttemptMs) break;
    try {
      const text = await call(
        model,
        Math.min(options.attemptTimeoutMs, remaining)
      );
      pool.report(model, 'ok');
      if (model !== pool.models[0]) log(`Answered by fallback model ${model}.`);
      return { text, model };
    } catch (error) {
      if (error instanceof GenerateConfigError) throw error;
      if (error instanceof ModelMissingError) {
        pool.report(model, 'missing');
        log(
          `Gemini model ${model} is not available; skipping it. Check GEMINI_MODEL / GEMINI_FALLBACK_MODELS.`
        );
      } else if (error instanceof GenerateBusyError) {
        pool.report(model, 'overloaded', error.retryAfter);
        failures.push('busy');
      } else if (error instanceof GenerateQuotaError) {
        pool.report(model, 'quota', error.retryAfter);
        failures.push('quota');
      } else if (error instanceof GenerateTimeoutError) {
        pool.report(model, 'timeout');
        failures.push('timeout');
      } else {
        throw error;
      }
    }
  }

  if (!failures.length && !pool.hasUsable())
    throw new GenerateConfigError(
      'None of the configured Gemini models exist.'
    );
  if (failures.includes('busy'))
    throw new GenerateBusyError(pool.nextRetryIn());
  if (failures.includes('quota'))
    throw new GenerateQuotaError(pool.nextRetryIn());
  throw new GenerateTimeoutError();
}
