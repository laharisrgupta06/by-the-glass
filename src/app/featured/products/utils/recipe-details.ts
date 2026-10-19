import { RecipeIngredient } from '../models/recipe.model';

/**
 * Ice and serving notes read from a recipe's own method and ingredients. Only what the
 * text says is reported; when it says nothing, nothing is returned (silence never
 * becomes "No ice").
 */

const ICE = String.raw`\bice\b(?![- ]?cream)`;
const has = (text: string, pattern: string | RegExp) =>
  (typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern).test(text);

/** e.g. "Shaken with ice; strained", "Stirred with ice; served over ice", "Over crushed ice". */
export function iceFrom(
  instructions: string | undefined,
  ingredients: RecipeIngredient[]
): string | undefined {
  const text = instructions ?? '';
  const listed = ingredients.find(i =>
    /^(ice|ice cubes|crushed ice|cracked ice)$/i.test(i.name.trim())
  );
  // Ice in the method, or listed as an ingredient the method then shakes or blends.
  const iceInMethod = has(text, ICE) || !!listed;
  const crushed =
    has(text, /\bcrushed ice\b/i) ||
    ingredients.some(i => /^crushed ice$/i.test(i.name.trim()));

  let mixed = '';
  if (iceInMethod) {
    if (has(text, /\b(shake[ns]?|shaken|shaking)\b/i))
      mixed = 'Shaken with ice';
    else if (has(text, /\bstir(red|ring|s)?\b/i)) mixed = 'Stirred with ice';
    else if (has(text, /\bblend(ed|er|ing)?\b/i)) mixed = 'Blended with ice';
  }
  const overIce = has(
    text,
    /\bover (fresh |crushed |cracked |cubed |shaved )?ice\b|\bon the rocks\b|\bice[- ]filled\b|\b(fill|filled|full) (it |the glass )?(with|of) (crushed |cracked |cubed |fresh )?ice\b|\bwith ice cubes\b/i
  );
  const strained = has(text, /\bstrain(ed|ing)?\b/i);

  const served = overIce
    ? crushed
      ? 'served over crushed ice'
      : 'served over ice'
    : mixed && strained
      ? 'strained'
      : '';
  if (mixed) return served ? `${mixed}; ${served}` : mixed;
  if (served) return served.charAt(0).toUpperCase() + served.slice(1);
  // Ice listed as an ingredient, with no word on how it's used.
  if (listed) return crushed ? 'With crushed ice' : 'With ice';
  return undefined;
}

/** Only what the method says about serving: temperature, a chilled glass, straight away. */
export function servingFrom(
  instructions: string | undefined
): string | undefined {
  const text = instructions ?? '';
  const notes: string[] = [];
  if (
    has(
      text,
      /\bserve[ds]? (it )?(hot|warm)\b|\bwhile (still )?(hot|warm)\b/i
    ) ||
    // Heated in the method (and not then chilled).
    (has(text, /\b(heat|heated|heating|simmer|simmering|microwave)\b/i) &&
      !has(text, /\b(chill|chilled|cool|cooled|refrigerate)\b/i))
  )
    notes.push('Served hot');
  else if (has(text, /\bserve[ds]? (it )?(cold|chilled|well chilled)\b/i))
    notes.push('Served cold');
  if (has(text, /\bchilled\b[^.]{0,30}\b(glass|flute|coupe|mug|tumbler)\b/i))
    notes.push('in a chilled glass');
  if (
    has(
      text,
      /\bserve[ds]? (it )?(immediately|at once|straight away|right away)\b/i
    )
  )
    notes.push('straight away');
  if (!notes.length) return undefined;
  const sentence = notes.join(', ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
