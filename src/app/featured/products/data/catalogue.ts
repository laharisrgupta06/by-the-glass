import { Recipe } from '../models/recipe.model';

/**
 * Every drink we can reach for browsing, and what the free API couldn't fully provide.
 * The free TheCocktailDB key caps its lists, so this is never "every drink there is".
 */
export interface Catalogue {
  recipes: Recipe[];
  /** First letters or digits whose page failed to load, e.g. ['B', '7']. */
  failedLetters: string[];
  /** True when one of the alcoholic / non-alcoholic / optional lists failed. */
  failedLists: boolean;
  /** Letters whose page hit the free-key cap, so there may be more drinks. */
  cappedLetters: string[];
  /**
   * Drinks whose ingredients couldn't be loaded (detailedCatalogue only): they're kept
   * as bare entries, so ingredient matching can't see them.
   */
  missingDetails: number;
}

/**
 * One entry per source and id, in first-seen order. A copy with full details replaces
 * one without (the browse lists only carry a name and photo). Different ids are never
 * merged here; same-name duplicates are left to curate().
 */
export function preferDetailed(recipes: Recipe[]): Recipe[] {
  const byKey = new Map<string, Recipe>();
  for (const recipe of recipes) {
    const key = `${recipe.source}:${recipe.id}`;
    const existing = byKey.get(key);
    if (!existing || (!existing.hasDetails && recipe.hasDetails))
      byKey.set(key, recipe);
  }
  return [...byKey.values()];
}
