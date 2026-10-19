import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, Observable, map, pipe, switchMap, tap } from 'rxjs';
import { tapResponse } from '@ngrx/operators';

import { Catalogue, preferDetailed } from '../data/catalogue';
import { DrinkRepository } from '../data/drink.repository';
import { isRequestTimeout } from '../services/cocktaildb-timeout.interceptor';
import { Recipe } from '../models/recipe.model';
import {
  DrinkQuery,
  byName,
  matchedIngredient,
  refineNameMatches,
} from '../utils/drink-filters';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
/** 'partial': some of the free API's lists or letters failed; the rest loaded. */
export type CatalogueStatus = LoadStatus | 'partial';

type ProductsState = {
  recipes: Recipe[];
  status: LoadStatus;
  ingredientStatus: LoadStatus;
  /** The full catalogue, merged in by the browser after the first results. */
  catalogueStatus: CatalogueStatus;
  failedLetters: string[];
  failedLists: boolean;
  cappedLetters: string[];
  recipe: Recipe | null;
  recipeStatus: LoadStatus | 'not-found';
};

const noCatalogue = {
  catalogueStatus: 'idle' as CatalogueStatus,
  failedLetters: [] as string[],
  failedLists: false,
  cappedLetters: [] as string[],
};

const initialState: ProductsState = {
  recipes: [],
  status: 'idle',
  ingredientStatus: 'idle',
  ...noCatalogue,
  recipe: null,
  recipeStatus: 'idle',
};

/** What the page needs to know about the catalogue's gaps and caps. */
function catalogueState({
  failedLetters,
  failedLists,
  cappedLetters,
}: Catalogue) {
  return {
    catalogueStatus: (failedLetters.length || failedLists
      ? 'partial'
      : 'ready') as CatalogueStatus,
    failedLetters,
    failedLists,
    cappedLetters,
  };
}

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
      // A slow TheCocktailDB during server rendering isn't an error worth sending:
      // the page keeps its loading state and the browser loads the drinks itself.
      const keepLoading = (error: unknown) =>
        !isBrowser && isRequestTimeout(error);
      const setError = (error: unknown) => {
        if (!keepLoading(error)) patchState(store, { status: 'error' });
      };
      const loaded = (source$: Observable<Recipe[]>) =>
        source$.pipe(tapResponse({ next: setRecipes, error: setError }));

      /**
       * After the first results (the browse lists or a letter), the browser merges in
       * every drink the free API lets us reach. The server only renders the first part.
       */
      const withCatalogue = (first$: Observable<Recipe[]>) =>
        first$.pipe(
          switchMap(() => {
            if (!isBrowser) return EMPTY;
            patchState(store, { catalogueStatus: 'loading' });
            return repository.catalogue().pipe(
              tapResponse({
                next: catalogue =>
                  patchState(store, {
                    recipes: preferDetailed([
                      ...store.recipes(),
                      ...catalogue.recipes,
                    ]),
                    ...catalogueState(catalogue),
                  }),
                error: () => patchState(store, { catalogueStatus: 'error' }),
              })
            );
          })
        );

      // Name matches first, then drinks that only match on an ingredient.
      const search = (q: string) =>
        loaded(
          repository
            .searchByName(q)
            .pipe(map(recipes => [...recipes].sort(byName)))
        ).pipe(
          switchMap(nameMatches => {
            // Skipped during SSR; the browser adds the rest after hydration: name
            // matches the API's 25-result search cut off, then ingredient matches.
            if (!isBrowser) return EMPTY;
            patchState(store, { ingredientStatus: 'loading' });
            const key = (r: Recipe) => `${r.source}:${r.id}`;
            return repository.catalogue().pipe(
              tapResponse({
                next: catalogue => {
                  const seen = new Set(nameMatches.map(key));
                  const others = catalogue.recipes.filter(
                    r => !seen.has(key(r))
                  );
                  // The same whole-word-or-prefix rule as the API's own matches.
                  const moreNames = refineNameMatches(
                    [...nameMatches, ...others],
                    q
                  ).filter(r => !seen.has(key(r)));
                  moreNames.forEach(r => seen.add(key(r)));
                  const ingredientMatches = others
                    .filter(r => !seen.has(key(r)) && matchedIngredient(r, q))
                    .sort(byName);
                  patchState(store, {
                    recipes: [
                      ...[...nameMatches, ...moreNames].sort(byName),
                      ...ingredientMatches,
                    ],
                    ingredientStatus: 'ready',
                    ...catalogueState(catalogue),
                  });
                },
                error: () => patchState(store, { ingredientStatus: 'error' }),
              })
            );
          })
        );

      return {
        /** Loads drinks for a search, a letter, a spirit, or (with none) the whole catalogue. */
        loadDrinks: rxMethod<DrinkQuery>(
          pipe(
            tap(() =>
              patchState(store, {
                status: 'loading',
                ingredientStatus: 'idle',
                ...noCatalogue,
              })
            ),
            switchMap(({ q, letter, spirit }) => {
              if (q) return search(q);
              if (letter)
                return withCatalogue(loaded(repository.byLetter(letter)));
              // Spirit browsing scans every detailed recipe; leave that to the browser.
              if (spirit)
                return isBrowser ? loaded(repository.detailed()) : EMPTY;
              return withCatalogue(loaded(repository.browse()));
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
                  error: (error: unknown) => {
                    if (!keepLoading(error))
                      patchState(store, { recipeStatus: 'error' });
                  },
                })
              )
            )
          )
        ),
      };
    }
  )
);
