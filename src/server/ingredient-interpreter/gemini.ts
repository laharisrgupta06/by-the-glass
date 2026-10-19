import { GoogleGenAI } from '@google/genai';

import { generateWithFallback } from './fallback';
import {
  ATTEMPT_TIMEOUT_MS,
  MIN_GEMINI_DEADLINE_MS,
  TOTAL_TIMEOUT_MS,
  classifyGeminiError,
  describeGeminiError,
  generateConfig,
} from './gemini-request';
import { Generate } from './handler';
import { ModelPool } from './model-pool';

/** A fast, inexpensive alias that Google keeps pointed at the current Flash model. */
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';
/**
 * Tried when the primary model is overloaded. Verified at startup, not assumed:
 * if Google retires it, it's logged and skipped. Override with GEMINI_FALLBACK_MODELS.
 */
export const DEFAULT_FALLBACK_MODELS = 'gemini-3.5-flash';

// Grace on top of Google's own deadline before we give up locally.
const LOCAL_GRACE_MS = 2_000;

/**
 * The only place that talks to Gemini. Server-side only: the API key comes from the
 * server's environment and never reaches the browser.
 */
export function createGeminiGenerator(options: {
  apiKey: string;
  models: string[];
}): Generate {
  const ai = new GoogleGenAI({ apiKey: options.apiKey });
  const pool = new ModelPool(options.models);
  void verifyModels(ai, pool, options.apiKey);

  return ({ system, prompt, schema, temperature, timeouts }) =>
    generateWithFallback(
      pool,
      async (model, timeoutMs) => {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: generateConfig(
              system,
              schema,
              timeoutMs,
              AbortSignal.timeout(timeoutMs + LOCAL_GRACE_MS),
              temperature
            ),
          });
          const text = response.text;
          if (!text) throw new Error('Gemini returned no text.');
          return text;
        } catch (error) {
          // Enough to spot a bad key, quota or model problem, never the key itself.
          console.warn(describeGeminiError(error, options.apiKey, model));
          throw classifyGeminiError(error, model);
        }
      },
      {
        attemptTimeoutMs: timeouts?.attemptMs ?? ATTEMPT_TIMEOUT_MS,
        totalTimeoutMs: timeouts?.totalMs ?? TOTAL_TIMEOUT_MS,
        minAttemptMs: MIN_GEMINI_DEADLINE_MS,
        log: message => console.log(message),
      }
    ).then(({ text }) => text);
}

/** Image models tried in order; override with GEMINI_IMAGE_MODELS. */
export const DEFAULT_IMAGE_MODELS =
  'gemini-2.5-flash-image,gemini-3.1-flash-image';
const IMAGE_ATTEMPT_MS = 60_000;
const IMAGE_TOTAL_MS = 90_000;

export interface GeneratedImage {
  data: Buffer;
  mimeType: string;
  model: string;
}

/** Creates one image from a prompt. Throws the errors in ./errors. */
export type GenerateImage = (prompt: string) => Promise<GeneratedImage>;

/**
 * Image generation through the same key, model fallback and cooldowns as text.
 * Server-side only. Used for venue-menu illustrations, which are made on request
 * and stored, never on every page view.
 */
export function createGeminiImageGenerator(options: {
  apiKey: string;
  models: string[];
}): GenerateImage {
  const ai = new GoogleGenAI({ apiKey: options.apiKey });
  const pool = new ModelPool(options.models);
  return async prompt => {
    const { text, model } = await generateWithFallback(
      pool,
      async (model, timeoutMs) => {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseModalities: ['IMAGE'],
              httpOptions: {
                timeout: Math.max(MIN_GEMINI_DEADLINE_MS, timeoutMs),
              },
              abortSignal: AbortSignal.timeout(timeoutMs + LOCAL_GRACE_MS),
            },
          });
          const image = response.candidates?.[0]?.content?.parts?.find(
            part => part.inlineData?.data
          )?.inlineData;
          if (!image?.data) throw new Error('Gemini returned no image.');
          // Passed through the fallback as text: "<mime type> <base64 data>".
          return `${image.mimeType ?? 'image/png'} ${image.data}`;
        } catch (error) {
          console.warn(describeGeminiError(error, options.apiKey, model));
          throw classifyGeminiError(error, model);
        }
      },
      {
        attemptTimeoutMs: IMAGE_ATTEMPT_MS,
        totalTimeoutMs: IMAGE_TOTAL_MS,
        minAttemptMs: MIN_GEMINI_DEADLINE_MS,
        log: message => console.log(message),
      }
    );
    const [mimeType, data] = text.split(' ');
    return { data: Buffer.from(data, 'base64'), mimeType, model };
  };
}

/**
 * Checks each configured model exists for this key. A metadata lookup, which doesn't
 * use generation quota. Missing models are skipped from then on; anything else (e.g.
 * no network at startup) leaves the model in place to be tried normally.
 */
async function verifyModels(
  ai: GoogleGenAI,
  pool: ModelPool,
  apiKey: string
): Promise<void> {
  const results = await Promise.all(
    pool.models.map(async model => {
      try {
        await ai.models.get({ model });
        return `${model} ok`;
      } catch (error) {
        if ((error as { status?: number }).status === 404) {
          pool.report(model, 'missing');
          return `${model} NOT AVAILABLE (skipped)`;
        }
        return `${model} unverified (${describeGeminiError(error, apiKey).slice(0, 80)})`;
      }
    })
  );
  console.log(`Gemini models: ${results.join('; ')}.`);
  if (!pool.hasUsable())
    console.warn(
      'No configured Gemini model is available. Set GEMINI_MODEL or GEMINI_FALLBACK_MODELS to a current model.'
    );
}
