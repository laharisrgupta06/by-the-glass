import {
  GenerateBusyError,
  GenerateConfigError,
  GenerateQuotaError,
  GenerateTimeoutError,
  ModelMissingError,
} from './errors';

/** Gemini rejects a request deadline under 10 s with 400 INVALID_ARGUMENT. */
export const MIN_GEMINI_DEADLINE_MS = 10_000;
/** Each model attempt gets this long; answers have taken 10-19 s. */
export const ATTEMPT_TIMEOUT_MS = 25_000;
/** Hard cap for one question, fallbacks included. */
export const TOTAL_TIMEOUT_MS = 45_000;
/** Used when Gemini doesn't say how long to wait. */
export const DEFAULT_BUSY_SECONDS = 60;

/**
 * The generateContent config, kept free of the SDK so it can be tested. Only options
 * Gemini accepts for structured output are used; the schema has no ingredient enum.
 * No retries: an overloaded model is put on cooldown and the next model is tried
 * instead, because retrying it only spends quota.
 */
export function generateConfig(
  system: string,
  schema: Record<string, unknown>,
  timeoutMs: number,
  signal: AbortSignal,
  temperature = 0.2
) {
  return {
    systemInstruction: system,
    responseMimeType: 'application/json',
    responseJsonSchema: schema,
    temperature,
    httpOptions: {
      timeout: Math.max(MIN_GEMINI_DEADLINE_MS, timeoutMs),
    },
    abortSignal: signal,
  };
}

/** Seconds from Gemini's RetryInfo ("51s"), if the error carries one. */
export function retryDelaySeconds(message: string): number | undefined {
  const match = message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return match ? Math.max(1, Math.ceil(Number(match[1]))) : undefined;
}

/**
 * Maps an SDK error to the errors in ./errors. Anything unrecognised (e.g. a network
 * failure reaching Google) is returned as is and reported as upstream-error.
 */
export function classifyGeminiError(error: unknown, model = ''): unknown {
  const name = (error as Error | undefined)?.name;
  if (name === 'TimeoutError' || name === 'AbortError')
    return new GenerateTimeoutError();
  const status = (error as { status?: number } | undefined)?.status;
  const wait = () =>
    retryDelaySeconds(String((error as Error).message ?? '')) ??
    DEFAULT_BUSY_SECONDS;
  switch (status) {
    case 500:
    case 503:
      return new GenerateBusyError(wait());
    case 504:
      return new GenerateTimeoutError();
    case 429:
      return new GenerateQuotaError(wait());
    case 404:
      return new ModelMissingError(model);
    case 400:
    case 401:
    case 403:
      return new GenerateConfigError();
    default:
      return error;
  }
}

/** A short, key-free description of an error for the server log. */
export function describeGeminiError(
  error: unknown,
  apiKey: string,
  model = ''
): string {
  const status = (error as { status?: number } | undefined)?.status;
  const message = String((error as Error | undefined)?.message ?? error)
    .split(apiKey)
    .join('[redacted]')
    .slice(0, 200);
  const where = model ? ` [${model}]` : '';
  return `Gemini request failed${where}${status ? ` (${status})` : ''}: ${message}`;
}
