import { Recipe, isMenuDescription } from '../../products/models/recipe.model';
import { DrinkType, matchesType } from '../../products/utils/drink-filters';
import { makeableRecipes } from './cabinet';

/** How many recent surprises to avoid repeating, when the pool allows it. */
export const RECENT_SURPRISES = 10;

/**
 * Drinks worth surprising someone with: the same quality rules as the Drinks page
 * (via makeableRecipes), the chosen type, and a photo and method to show.
 */
export function surprisePool(recipes: Recipe[], type: DrinkType): Recipe[] {
  return makeableRecipes(recipes).filter(
    recipe =>
      // Never a menu description: Surprise Me shows a recipe you can make.
      !isMenuDescription(recipe) &&
      matchesType(recipe, type) &&
      !!recipe.image &&
      !!recipe.instructions?.trim()
  );
}

export function surpriseKey(recipe: Pick<Recipe, 'source' | 'id'>): string {
  return `${recipe.source}:${recipe.id}`;
}

/**
 * A random drink from the pool, skipping recent picks so "another" really is another.
 * With a tiny pool it repeats rather than giving up. Undefined only for an empty pool.
 */
export function pickSurprise(
  pool: Recipe[],
  recent: string[] = [],
  random: () => number = Math.random
): Recipe | undefined {
  if (!pool.length) return undefined;
  // Never avoid the whole pool; slice(-0) would mean "everything".
  const count = Math.min(RECENT_SURPRISES, pool.length - 1);
  const avoid = new Set(count > 0 ? recent.slice(-count) : []);
  const fresh = pool.filter(recipe => !avoid.has(surpriseKey(recipe)));
  const choices = fresh.length ? fresh : pool;
  // Clamp in case random() returns exactly 1.
  return choices[
    Math.min(Math.floor(random() * choices.length), choices.length - 1)
  ];
}
