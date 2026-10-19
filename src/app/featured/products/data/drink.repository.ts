import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';

import { Recipe } from '../models/recipe.model';
import { refineNameMatches } from '../utils/drink-filters';
import { Catalogue } from './catalogue';
import { CocktailDbSource } from './cocktaildb.source';
import { CuratedSource } from './curated.source';
import { DrinkSource } from './drink-source';
import { VenueMenuSource } from './venue-menu/venue-menu.source';

/**
 * Merges every drink source. Curated recipes come first so they win when the
 * quality layer de-duplicates by name. Venue-menu listings (menu descriptions, not
 * recipes) sit before TheCocktailDB only so their fixed ids resolve without an API call.
 */
@Injectable()
export class DrinkRepository {
  private curated = inject(CuratedSource);
  private venueMenu = inject(VenueMenuSource);
  private cocktailDb = inject(CocktailDbSource);
  private sources: DrinkSource[] = [
    this.curated,
    this.venueMenu,
    this.cocktailDb,
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

  /** Everything browsable from every source, for the main list, A–Z and search. */
  catalogue(): Observable<Catalogue> {
    return this.withLocalSources(this.cocktailDb.catalogue());
  }

  /**
   * The same catalogue with every drink's ingredients loaded, for ingredient matching.
   * The main Drinks list doesn't need these extra lookups, so it uses catalogue().
   */
  detailedCatalogue(): Observable<Catalogue> {
    return this.withLocalSources(this.cocktailDb.detailedCatalogue());
  }

  private withLocalSources(
    cocktailDb$: Observable<Catalogue>
  ): Observable<Catalogue> {
    return forkJoin([
      this.curated.browse(),
      this.venueMenu.browse(),
      cocktailDb$,
    ]).pipe(
      map(([curated, menu, cocktailDb]) => ({
        ...cocktailDb,
        recipes: [...curated, ...menu, ...cocktailDb.recipes],
      }))
    );
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
