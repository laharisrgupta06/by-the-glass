import {
  IngredientInterpretation,
  InterpretErrorCode,
  cleanTerm,
  cleanVocabulary,
  sanitizeInterpretation,
} from '../../app/core/ai/ingredient-interpretation';
import {
  GenerateBusyError,
  GenerateConfigError,
  GenerateQuotaError,
  GenerateTimeoutError,
} from './errors';
import { SYSTEM_INSTRUCTION, buildPrompt, responseSchema } from './prompt';
import { RateLimiter } from './rate-limiter';
import { TtlCache, fingerprint } from './ttl-cache';

/** One call to the model: returns its raw JSON text, or throws. */
export type Generate = (request: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  /** Defaults to 0.2: factual. Recipes use a little more. */
  temperature?: number;
  /** Longer answers (recipes) need longer than the defaults. */
  timeouts?: { attemptMs: number; totalMs: number };
}) => Promise<string>;

export interface InterpreterDeps {
  /** Undefined when no API key is configured: the feature is off. */
  generate?: Generate;
  cache: TtlCache<IngredientInterpretation>;
  perClient: RateLimiter;
  global: RateLimiter;
}

/** Every error code the /api routes answer with. */
export type ApiErrorCode =
  | InterpretErrorCode
  /** No such drink, or nothing stored for it. */
  | 'not-found'
  /** Switched off on this server (e.g. illustration generation). */
  | 'disabled';

export interface HandlerResult<T = IngredientInterpretation> {
  status: number;
  body: T | { error: ApiErrorCode };
  /** Seconds, for a Retry-After header. */
  retryAfter?: number;
}

// The errors a Generate implementation throws; re-exported for existing imports.
export {
  GenerateBusyError,
  GenerateConfigError,
  GenerateQuotaError,
  GenerateTimeoutError,
} from './errors';

export const fail = (
  status: number,
  error: ApiErrorCode,
  retryAfter?: number
): HandlerResult<never> => ({ status, body: { error }, retryAfter });

/** What to answer when asking Gemini failed. Each cause keeps its own code. */
export function generationFailure(error: unknown): HandlerResult<never> {
  if (error instanceof GenerateBusyError)
    return fail(503, 'busy', error.retryAfter);
  if (error instanceof GenerateQuotaError)
    return fail(429, 'quota', error.retryAfter);
  if (error instanceof GenerateTimeoutError) return fail(504, 'timeout');
  if (error instanceof GenerateConfigError) return fail(500, 'misconfigured');
  return fail(502, 'upstream-error');
}

/** Lets browsers on this site in, and turns away pages on other sites. */
export function isSameOrigin(
  origin: string | undefined,
  host: string | undefined
): boolean {
  // Same-origin GETs and non-browser clients don't send Origin; rate limits cover those.
  if (!origin) return true;
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function statusBody(deps: InterpreterDeps): { available: boolean } {
  return { available: !!deps.generate };
}

export async function handleInterpret(
  body: unknown,
  client: { id: string; origin?: string; host?: string },
  deps: InterpreterDeps
): Promise<HandlerResult> {
  if (!deps.generate) return fail(503, 'unavailable');
  if (!isSameOrigin(client.origin, client.host)) return fail(403, 'forbidden');

  const data = (body && typeof body === 'object' ? body : {}) as Record<
    string,
    unknown
  >;
  const term = cleanTerm(data['term']);
  const vocabulary = cleanVocabulary(data['vocabulary']);
  if (!term || !vocabulary) return fail(400, 'invalid-request');

  const cacheKey = `${term.toLowerCase()}|${fingerprint(
    [...vocabulary].sort().join('\n')
  )}`;
  const cached = deps.cache.get(cacheKey);
  if (cached) return { status: 200, body: { ...cached, term } };

  const wait = deps.perClient.take(client.id) || deps.global.take('everyone');
  if (wait) return fail(429, 'rate-limited', wait);

  let raw: string;
  try {
    raw = await deps.generate({
      system: SYSTEM_INSTRUCTION,
      prompt: buildPrompt(term, vocabulary),
      schema: responseSchema(),
    });
  } catch (error) {
    // Each cause keeps its own code, so the page can say what actually happened.
    return generationFailure(error);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail(502, 'upstream-error');
  }
  const interpretation = sanitizeInterpretation(parsed, term, vocabulary);
  // An answer with nothing to say isn't worth showing or keeping.
  if (!interpretation.summary && !interpretation.suggestions.length)
    return fail(502, 'upstream-error');
  deps.cache.set(cacheKey, interpretation);
  return { status: 200, body: interpretation };
}
