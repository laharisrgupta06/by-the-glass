import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';

import { Recipe } from '../models/recipe.model';
import { refineNameMatches } from '../utils/drink-filters';
import { CocktailDbSource } from './cocktaildb.source';
import { CuratedSource } from './curated.source';
import { DrinkSource } from './drink-source';

/**
 * Merges every drink source. Curated recipes come first so they win when the
 * quality layer de-duplicates by name.
 */
@Injectable()
export class DrinkRepository {
  private sources: DrinkSource[] = [
    inject(CuratedSource),
    inject(CocktailDbSource),
  ];

  browse(): Observable<Recipe[]> {
    return this.merge(source => source.browse());
  }

  byLetter(letter: string): Observable<Recipe[]> {
    return this.merge(source => source.byLetter(letter));
  }

  searchByName(query: string): Observable<Recipe[]> {
    return this.merge(source => source.searchByName(query)).pipe(
      map(recipes => refineNameMatches(recipes, query))
    );
  }

  detailed(): Observable<Recipe[]> {
    return this.merge(source => source.detailed());
  }

  /** The first source that has the recipe wins. */
  byId(id: string): Observable<Recipe | undefined> {
    return this.sources.reduce<Observable<Recipe | undefined>>(
      (found$, source) =>
        found$.pipe(switchMap(found => (found ? of(found) : source.byId(id)))),
      of(undefined)
    );
  }

  private merge(
    request: (source: DrinkSource) => Observable<Recipe[]>
  ): Observable<Recipe[]> {
    return forkJoin(this.sources.map(request)).pipe(
      map(lists => {
        const seen = new Set<string>();
        return lists.flat().filter(recipe => {
          const key = `${recipe.source}:${recipe.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      })
    );
  }
}
