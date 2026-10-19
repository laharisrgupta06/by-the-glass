import { Recipe, isMenuDescription } from '../models/recipe.model';

/**
 * Decides which recipes are worth showing in discovery. Nothing is deleted:
 * hidden recipes still open from a direct link, and the rules only look at
 * what the source actually provides.
 */
export type QualityIssue =
  | 'single-ingredient'
  | 'no-method'
  | 'no-measurements'
  | 'trivial'
  | 'duplicate';

const ICE = new Set(['ice', 'ice cubes', 'crushed ice', 'cracked ice']);
// Two ingredients and a one-liner like "Mix together and enjoy!" isn't much of a recipe.
const TRIVIAL_METHOD_LENGTH = 40;

export function qualityIssues(recipe: Recipe): QualityIssue[] {
  // List entries without details can't be judged yet, so they're given the benefit of the doubt.
  if (!recipe.hasDetails) return [];
  // A menu description has no method or measures by nature; it only needs ingredients.
  // It is never shown as a recipe, so the recipe checks below don't apply.
  if (isMenuDescription(recipe))
    return recipe.ingredients.length ? [] : ['single-ingredient'];

  const issues: QualityIssue[] = [];
  const meaningful = recipe.ingredients.filter(
    i => !ICE.has(i.name.toLowerCase())
  );
  const method = recipe.instructions ?? '';

  if (meaningful.length < 2) issues.push('single-ingredient');
  if (method.length < 10) issues.push('no-method');
  if (!recipe.ingredients.some(i => i.measure)) issues.push('no-measurements');
  if (meaningful.length === 2 && method.length < TRIVIAL_METHOD_LENGTH)
    issues.push('trivial');
  return issues;
}

/** "Planter’s Punch" and "Planters Punch", or "Vodka Tonic" and "Vodka And Tonic", are one drink. */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(word => word && !['and', 'the', 'a'].includes(word))
    .join(' ');
}

function measuredCount(recipe: Recipe): number {
  return recipe.ingredients.filter(i => i.measure).length;
}

export interface CuratedList {
  recipes: Recipe[];
  hidden: number;
}

/** Drops low-quality recipes, then keeps the best-documented copy of each duplicate. */
export function curate(recipes: Recipe[]): CuratedList {
  const best = new Map<string, Recipe>();
  let hidden = 0;
  for (const recipe of recipes) {
    if (qualityIssues(recipe).length) {
      hidden++;
      continue;
    }
    // A venue's drink can differ from the generic recipe, so the two never merge,
    // even when they share a name.
    const group = isMenuDescription(recipe) ? 'menu' : 'recipe';
    const key = `${group}:${nameKey(recipe.name)}`;
    const existing = best.get(key);
    if (!existing) {
      best.set(key, recipe);
      continue;
    }
    hidden++;
    if (
      existing.source !== 'curated' &&
      measuredCount(recipe) > measuredCount(existing)
    )
      best.set(key, recipe);
  }
  const kept = new Set(best.values());
  return { recipes: recipes.filter(r => kept.has(r)), hidden };
}
