/**
 * The contract for "Ask our bartender": Gemini explains an ingredient our drinks
 * don't use, and may point to ingredients they do. Shared by the browser and the
 * server, so both apply the same checks. Nothing here talks to Gemini.
 */

/** How a suggested ingredient relates to what was typed. */
export type IngredientRelation = 'same' | 'made-from' | 'similar';

export const RELATIONS: IngredientRelation[] = ['same', 'made-from', 'similar'];

export const RELATION_LABELS: Record<IngredientRelation, string> = {
  same: 'Same thing',
  'made-from': 'Made from it',
  similar: 'Similar',
};

export interface InterpretationSuggestion {
  /** Exactly one of the ingredient names that was sent; never anything else. */
  ingredient: string;
  relation: IngredientRelation;
  reason: string;
}

export interface IngredientInterpretation {
  term: string;
  /** One or two sentences about what the ingredient is. */
  summary: string;
  suggestions: InterpretationSuggestion[];
}

export interface InterpretRequest {
  term: string;
  /** Every ingredient our drinks use, as labelled on the page. */
  vocabulary: string[];
}

export const INTERPRET_LIMITS = {
  termLength: 60,
  vocabularySize: 800,
  labelLength: 80,
  suggestions: 3,
  summaryLength: 320,
  reasonLength: 160,
};

export const INTERPRET_PATHS = {
  interpret: '/api/ingredients/interpret',
  status: '/api/ingredients/interpret/status',
};

/** Error codes the endpoint answers with. */
export type InterpretErrorCode =
  /** No API key configured: the feature is off. */
  | 'unavailable'
  | 'invalid-request'
  | 'forbidden'
  /** Our own per-visitor or overall limit. */
  | 'rate-limited'
  /** Every Gemini model tried is overloaded. */
  | 'busy'
  /** The Gemini quota is used up. */
  | 'quota'
  | 'timeout'
  /** Bad key, invalid request or no usable model: see the server log. */
  | 'misconfigured'
  | 'upstream-error';

export const INTERPRET_ERROR_CODES: InterpretErrorCode[] = [
  'unavailable',
  'invalid-request',
  'forbidden',
  'rate-limited',
  'busy',
  'quota',
  'timeout',
  'misconfigured',
  'upstream-error',
];

// Control and invisible formatting characters have no place in a short label.
const UNPRINTABLE = new RegExp(
  // eslint-disable-next-line no-control-regex
  '[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff]',
  'g'
);

/** Strips unprintable characters, collapses whitespace and trims. */
export function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(UNPRINTABLE, ' ').replace(/\s+/g, ' ').trim();
}

/** Shortens on a word boundary, marking the cut with an ellipsis. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, '')}…`;
}

/** A typed ingredient worth asking about, or null. */
export function cleanTerm(value: unknown): string | null {
  const term = cleanText(value);
  if (!term || term.length > INTERPRET_LIMITS.termLength) return null;
  return /[\p{L}\p{N}]/u.test(term) ? term : null;
}

/** The ingredient list, de-duplicated, or null when it isn't a usable list. */
export function cleanVocabulary(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.length || value.length > INTERPRET_LIMITS.vocabularySize)
    return null;
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const item of value) {
    const label = cleanText(item);
    if (!label || label.length > INTERPRET_LIMITS.labelLength) return null;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

/**
 * Keeps only what can be trusted from a model answer: suggestions must name an
 * ingredient from the vocabulary (returned in its exact spelling), with a known
 * relation. Anything else is dropped, never repaired into something new.
 */
export function sanitizeInterpretation(
  raw: unknown,
  term: string,
  vocabulary: string[]
): IngredientInterpretation {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  const known = new Map(vocabulary.map(label => [label.toLowerCase(), label]));
  const termKey = term.toLowerCase();
  const seen = new Set<string>();
  const suggestions: InterpretationSuggestion[] = [];

  for (const item of Array.isArray(data['suggestions'])
    ? data['suggestions']
    : []) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const ingredient = known.get(cleanText(entry['ingredient']).toLowerCase());
    const relation = entry['relation'] as IngredientRelation;
    if (!ingredient || !RELATIONS.includes(relation)) continue;
    // Suggesting the very thing that had no match would be no help.
    if (ingredient.toLowerCase() === termKey || seen.has(ingredient)) continue;
    seen.add(ingredient);
    suggestions.push({
      ingredient,
      relation,
      reason: truncate(
        cleanText(entry['reason']),
        INTERPRET_LIMITS.reasonLength
      ),
    });
    if (suggestions.length === INTERPRET_LIMITS.suggestions) break;
  }

  return {
    term,
    summary: truncate(
      cleanText(data['summary']),
      INTERPRET_LIMITS.summaryLength
    ),
    suggestions,
  };
}
