import { DrinkKind, Recipe } from '../models/recipe.model';
import { SpiritDefinition } from '../data/spirit-taxonomy';

export type DrinkType = 'both' | 'cocktail' | 'mocktail';

/** The part of the filters that decides which request to make. The rest is applied locally. */
export interface DrinkQuery {
  q: string;
  letter: string;
  /** Spirit browsing on its own needs every detailed recipe, not the browse lists. */
  spirit: string;
}

export interface DrinkFilters {
  q: string;
  letter: string;
  type: DrinkType;
  spirit: string;
}

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const MIN_QUERY_LENGTH = 2;

export function byName(a: Recipe, b: Recipe): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function wordPattern(query: string, wholeWord: boolean): RegExp {
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const end = wholeWord ? '($|[^\\p{L}])' : '';
  return new RegExp(`(^|[^\\p{L}])${escaped}${end}`, 'iu');
}

/** The first ingredient containing the query as a whole word, e.g. "rum" matches "Light rum" but "gin" not "Ginger ale". */
export function matchedIngredient(
  recipe: Recipe,
  query: string
): string | undefined {
  const pattern = wordPattern(query, true);
  return recipe.ingredients.find(ingredient => pattern.test(ingredient.name))
    ?.name;
}

/**
 * Name searches can match anywhere in a name ("gin" finds "Pineapple Gingerale").
 * Keep whole-word matches when there are any, otherwise word prefixes so "marg" still finds Margarita.
 */
export function refineNameMatches(recipes: Recipe[], query: string): Recipe[] {
  const prefix = wordPattern(query, false);
  const whole = wordPattern(query, true);
  const prefixMatches = recipes.filter(recipe => prefix.test(recipe.name));
  const wholeMatches = prefixMatches.filter(recipe => whole.test(recipe.name));
  return wholeMatches.length ? wholeMatches : prefixMatches;
}

/**
 * Alcohol-free stand-ins such as "Sober gin" or "non-alcoholic rum" name a spirit but
 * contain none, so they never count for a spirit filter.
 */
const ALCOHOL_FREE =
  /(^|[^\p{L}])(sober|non[- ]?alcoholic|alcohol[- ]free|zero[- ]proof)([^\p{L}]|$)/iu;

export function isAlcoholFree(ingredient: string): boolean {
  return ALCOHOL_FREE.test(ingredient);
}

/** The ingredient that makes this recipe count for the spirit, if any. */
export function spiritIngredient(
  recipe: Recipe,
  spirit: SpiritDefinition
): string | undefined {
  const terms = spirit.terms.map(term => wordPattern(term, true));
  const excluded = new Set(spirit.exclude?.map(e => e.toLowerCase()));
  return recipe.ingredients.find(
    ({ name }) =>
      !excluded.has(name.toLowerCase()) &&
      !isAlcoholFree(name) &&
      terms.some(t => t.test(name))
  )?.name;
}

export function matchesType(recipe: Recipe, type: DrinkType): boolean {
  if (type === 'cocktail') return recipe.kind !== 'mocktail';
  if (type === 'mocktail') return recipe.kind !== 'cocktail';
  return true;
}

export function startsWithLetter(recipe: Recipe, letter: string): boolean {
  return recipe.name.toUpperCase().startsWith(letter);
}

const KIND_LABELS: Record<DrinkKind, string> = {
  cocktail: 'Cocktail',
  mocktail: 'Mocktail',
  optional: 'Optional alcohol',
};

export function kindLabel(kind: DrinkKind | undefined): string | undefined {
  return kind && KIND_LABELS[kind];
}

/** Like kindLabel, but names a zero-proof cocktail as one (its kind is 'mocktail'). */
export function drinkLabel(
  recipe: Pick<Recipe, 'kind' | 'style'>
): string | undefined {
  return recipe.style === 'zero-proof'
    ? 'Zero-proof cocktail'
    : kindLabel(recipe.kind);
}

export function parseFilters(
  params: { get(name: string): string | null },
  spirits: SpiritDefinition[]
): DrinkFilters {
  const letter = (params.get('letter') ?? '').toUpperCase();
  const type = params.get('type');
  const spirit = params.get('spirit') ?? '';
  return {
    q: (params.get('q') ?? '').trim(),
    letter: LETTERS.includes(letter) ? letter : '',
    type: type === 'cocktail' || type === 'mocktail' ? type : 'both',
    spirit: spirits.some(s => s.id === spirit) ? spirit : '',
  };
}

/** Search wins over A–Z, and both win over spirit; the others then narrow results locally. */
export function toQuery({ q, letter, spirit }: DrinkFilters): DrinkQuery {
  const query = q.length >= MIN_QUERY_LENGTH ? q : '';
  if (query) return { q: query, letter: '', spirit: '' };
  if (letter) return { q: '', letter, spirit: '' };
  return { q: '', letter: '', spirit };
}
