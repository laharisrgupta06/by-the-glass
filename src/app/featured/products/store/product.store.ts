import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, Observable, map, pipe, switchMap, tap } from 'rxjs';
import { tapResponse } from '@ngrx/operators';

import { DrinkRepository } from '../data/drink.repository';
import { Recipe } from '../models/recipe.model';
import { DrinkQuery, byName, matchedIngredient } from '../utils/drink-filters';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

type ProductsState = {
  recipes: Recipe[];
  status: LoadStatus;
  ingredientStatus: LoadStatus;
  recipe: Recipe | null;
  recipeStatus: LoadStatus | 'not-found';
};

const initialState: ProductsState = {
  recipes: [],
  status: 'idle',
  ingredientStatus: 'idle',
  recipe: null,
  recipeStatus: 'idle',
};

export const ProductsStore = signalStore(
  withState<ProductsState>(initialState),
  withMethods(
    (
      store,
      repository = inject(DrinkRepository),
      isBrowser = isPlatformBrowser(inject(PLATFORM_ID))
    ) => {
      const setRecipes = (recipes: Recipe[]) =>
        patchState(store, { recipes, status: 'ready' });
      const setError = () => patchState(store, { status: 'error' });
      const loaded = (source$: Observable<Recipe[]>) =>
        source$.pipe(tapResponse({ next: setRecipes, error: setError }));

      // Name matches first, then drinks that only match on an ingredient.
      const search = (q: string) =>
        loaded(
          repository
            .searchByName(q)
            .pipe(map(recipes => [...recipes].sort(byName)))
        ).pipe(
          switchMap(nameMatches => {
            // Skipped during SSR; the browser adds ingredient matches after hydration.
            if (!isBrowser) return EMPTY;
            patchState(store, { ingredientStatus: 'loading' });
            const seen = new Set(nameMatches.map(r => `${r.source}:${r.id}`));
            return repository.detailed().pipe(
              tapResponse({
                next: detailed => {
                  const ingredientMatches = detailed
                    .filter(
                      r =>
                        !seen.has(`${r.source}:${r.id}`) &&
                        matchedIngredient(r, q)
                    )
                    .sort(byName);
                  patchState(store, {
                    recipes: [...nameMatches, ...ingredientMatches],
                    ingredientStatus: 'ready',
                  });
                },
                error: () => patchState(store, { ingredientStatus: 'error' }),
              })
            );
          })
        );

      return {
        /** Loads drinks for a search, a letter, a spirit, or (with none) the browse lists. */
        loadDrinks: rxMethod<DrinkQuery>(
          pipe(
            tap(() =>
              patchState(store, { status: 'loading', ingredientStatus: 'idle' })
            ),
            switchMap(({ q, letter, spirit }) => {
              if (q) return search(q);
              if (letter) return loaded(repository.byLetter(letter));
              // Spirit browsing scans every detailed recipe; leave that to the browser.
              if (spirit)
                return isBrowser ? loaded(repository.detailed()) : EMPTY;
              return loaded(repository.browse());
            })
          )
        ),
        loadRecipe: rxMethod<string>(
          pipe(
            tap(() => patchState(store, { recipeStatus: 'loading' })),
            switchMap(id =>
              repository.byId(id).pipe(
                tapResponse({
                  next: recipe =>
                    patchState(store, {
                      recipe: recipe ?? null,
                      recipeStatus: recipe ? 'ready' : 'not-found',
                    }),
                  error: () => patchState(store, { recipeStatus: 'error' }),
                })
              )
            )
          )
        ),
      };
    }
  )
);
