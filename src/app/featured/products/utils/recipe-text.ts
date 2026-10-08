import { RecipeIngredient } from '../models/recipe.model';

const MAX_GARNISH_LENGTH = 60;

/**
 * Garnish as the source states it: the "garnish with …" phrase from the method,
 * or an ingredient whose measure says "garnish". Undefined if neither exists.
 */
export function findGarnish(
  instructions: string | undefined,
  ingredients: RecipeIngredient[]
): string | undefined {
  const phrase = instructions
    ?.match(/garnish(?:ed)?\s+with\s+([^.;!]+)/i)?.[1]
    ?.trim()
    .replace(/,$/, '');
  // Long clauses read better in the method than as a one-line fact.
  if (phrase && phrase.length <= MAX_GARNISH_LENGTH) return capitalise(phrase);
  const garnish = ingredients.find(i => /^garnish/i.test(i.measure ?? ''));
  return garnish?.name;
}

/** Splits a method into sentences so it reads as steps. Wording is untouched. */
export function toSteps(instructions: string | undefined): string[] {
  if (!instructions) return [];
  return instructions
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map(step => step.trim())
    .filter(Boolean);
}

const ML_PER_UNIT: Record<string, number> = { oz: 30, cl: 10 };
const QUANTITY = String.raw`(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)`;
const SIMPLE_MEASURE = new RegExp(
  `^${QUANTITY}(?:\\s*-\\s*${QUANTITY})?\\s*(oz|cl)\\.?$`,
  'i'
);

function parseQuantity(value: string): number {
  return value
    .trim()
    .split(/\s+/)
    .reduce((total, part) => {
      const [top, bottom] = part.split('/').map(Number);
      return total + (bottom ? top / bottom : top);
    }, 0);
}

function formatMl(value: number): string {
  return String(Math.round(value * 2) / 2);
}

/**
 * Metric equivalent for plain oz/cl measures, e.g. "1 1/2 oz" → "≈ 45 ml" using the
 * 30 ml bar ounce. Anything less precise ("1 shot", "Juice of 1/2") gets no hint.
 */
export function metricHint(measure: string | undefined): string | undefined {
  const match = measure?.trim().match(SIMPLE_MEASURE);
  if (!match) return undefined;
  const [, from, to, unit] = match;
  const factor = ML_PER_UNIT[unit.toLowerCase()];
  const amount = [from, to]
    .filter(Boolean)
    .map(q => formatMl(parseQuantity(q) * factor))
    .join('–');
  return unit.toLowerCase() === 'oz' ? `≈ ${amount} ml` : `${amount} ml`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
