import {
  GenerateBusyError,
  GenerateConfigError,
  GenerateQuotaError,
  GenerateTimeoutError,
  ModelMissingError,
} from './errors';
import {
  ATTEMPT_TIMEOUT_MS,
  DEFAULT_BUSY_SECONDS,
  MIN_GEMINI_DEADLINE_MS,
  TOTAL_TIMEOUT_MS,
  classifyGeminiError,
  describeGeminiError,
  generateConfig,
  retryDelaySeconds,
} from './gemini-request';
import { responseSchema } from './prompt';

const apiError = (status: number, message = 'x') =>
  Object.assign(new Error(message), { name: 'ApiError', status });

describe('Gemini request', () => {
  const signal = new AbortController().signal;

  it('asks for JSON with the fixed schema and the given deadline', () => {
    const config = generateConfig('system', responseSchema(), 20_000, signal);
    expect(config.systemInstruction).toBe('system');
    expect(config.responseMimeType).toBe('application/json');
    expect(config.responseJsonSchema).toEqual(responseSchema());
    expect(config.httpOptions.timeout).toBe(20_000);
    expect(config.abortSignal).toBe(signal);
  });

  it('never sends a deadline below Gemini’s 10 second minimum', () => {
    // A 9 s deadline was rejected: "Minimum allowed deadline is 10s."
    expect(
      generateConfig('s', responseSchema(), 3_000, signal).httpOptions.timeout
    ).toBe(MIN_GEMINI_DEADLINE_MS);
    expect(ATTEMPT_TIMEOUT_MS).toBeGreaterThanOrEqual(MIN_GEMINI_DEADLINE_MS);
    // Answers have taken up to 19 s; leave room for one fallback after a slow failure.
    expect(ATTEMPT_TIMEOUT_MS).toBeGreaterThanOrEqual(20_000);
    expect(TOTAL_TIMEOUT_MS).toBeGreaterThanOrEqual(
      ATTEMPT_TIMEOUT_MS + MIN_GEMINI_DEADLINE_MS
    );
  });

  it('does not retry the same model (that only spends quota)', () => {
    const config = generateConfig('s', responseSchema(), 20_000, signal);
    expect('retryOptions' in config.httpOptions).toBeFalse();
  });

  it('classifies each Gemini failure', () => {
    expect(
      classifyGeminiError(
        Object.assign(new Error('t'), { name: 'TimeoutError' })
      )
    ).toEqual(jasmine.any(GenerateTimeoutError));
    expect(classifyGeminiError(apiError(503))).toEqual(
      jasmine.any(GenerateBusyError)
    );
    expect(classifyGeminiError(apiError(500))).toEqual(
      jasmine.any(GenerateBusyError)
    );
    expect(classifyGeminiError(apiError(504, 'Deadline expired'))).toEqual(
      jasmine.any(GenerateTimeoutError)
    );
    const quota = classifyGeminiError(
      apiError(429, '{"error":{"details":[{"retryDelay":"51s"}]}}')
    ) as GenerateQuotaError;
    expect(quota).toEqual(jasmine.any(GenerateQuotaError));
    expect(quota.retryAfter).toBe(51);
    expect(
      (classifyGeminiError(apiError(503)) as GenerateBusyError).retryAfter
    ).toBe(DEFAULT_BUSY_SECONDS);
    const missing = classifyGeminiError(
      apiError(404),
      'gemini-2.5-flash'
    ) as ModelMissingError;
    expect(missing).toEqual(jasmine.any(ModelMissingError));
    expect(missing.model).toBe('gemini-2.5-flash');
    for (const status of [400, 401, 403])
      expect(classifyGeminiError(apiError(status))).toEqual(
        jasmine.any(GenerateConfigError)
      );
    const network = new TypeError('fetch failed');
    expect(classifyGeminiError(network)).toBe(network);
  });

  it('reads Google’s suggested wait', () => {
    expect(retryDelaySeconds('"retryDelay": "51s"')).toBe(51);
    expect(retryDelaySeconds('"retryDelay":"0.4s"')).toBe(1);
    expect(retryDelaySeconds('no hint')).toBeUndefined();
  });

  it('never puts the API key in the log line, and names the model', () => {
    const line = describeGeminiError(
      apiError(400, 'bad key SECRET-123 rejected'),
      'SECRET-123',
      'gemini-x'
    );
    expect(line).toBe(
      'Gemini request failed [gemini-x] (400): bad key [redacted] rejected'
    );
  });
});
