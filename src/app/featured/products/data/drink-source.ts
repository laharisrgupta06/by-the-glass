import { Observable } from 'rxjs';

import { Recipe } from '../models/recipe.model';

/**
 * A place drinks come from. The repository merges every source, so adding the
 * curated collection (or a future one) doesn't change the store or the pages.
 */
export interface DrinkSource {
  /** The default browsing list. Entries may lack details (hasDetails: false). */
  browse(): Observable<Recipe[]>;
  /** Drinks whose name starts with the letter, with full details. */
  byLetter(letter: string): Observable<Recipe[]>;
  /** Drinks whose name matches the query, with full details. */
  searchByName(query: string): Observable<Recipe[]>;
  /** Every recipe with full ingredient data, for ingredient and spirit matching. */
  detailed(): Observable<Recipe[]>;
  /** A single recipe, or undefined if this source doesn't have it. */
  byId(id: string): Observable<Recipe | undefined>;
}
