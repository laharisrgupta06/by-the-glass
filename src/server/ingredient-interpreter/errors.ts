/**
 * What can go wrong when asking Gemini, in the terms the handler reports. The SDK's
 * own errors are translated into these by classifyGeminiError.
 */

/** Every model tried is overloaded (Google 503/500) or cooling down after it. */
export class GenerateBusyError extends Error {
  constructor(readonly retryAfter: number) {
    super('The model is busy.');
    this.name = 'GenerateBusyError';
  }
}

/** The project's Gemini quota is used up (Google 429). */
export class GenerateQuotaError extends Error {
  constructor(readonly retryAfter: number) {
    super('The Gemini quota is used up.');
    this.name = 'GenerateQuotaError';
  }
}

/** The model didn't answer in time (our deadline or Google's 504). */
export class GenerateTimeoutError extends Error {
  constructor() {
    super('The model took too long to answer.');
    this.name = 'GenerateTimeoutError';
  }
}

/** The model name doesn't exist or is retired for this key (Google 404). */
export class ModelMissingError extends Error {
  constructor(readonly model = '') {
    super(`Model ${model} is not available.`);
    this.name = 'ModelMissingError';
  }
}

/**
 * A setup problem no other model would fix: a bad or unauthorised key, an invalid
 * request (Google 400/401/403), or no usable model configured at all.
 */
export class GenerateConfigError extends Error {
  constructor(message = 'Gemini is not set up correctly.') {
    super(message);
    this.name = 'GenerateConfigError';
  }
}
