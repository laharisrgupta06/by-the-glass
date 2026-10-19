import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, pipe, switchMap } from 'rxjs';
import { tapResponse } from '@ngrx/operators';

import { DrinkRepository } from '../../products/data/drink.repository';
import { Recipe } from '../../products/models/recipe.model';
import { LoadStatus } from '../../products/store/product.store';

/** What the free API couldn't provide this time; matching runs on the rest. */
export interface CabinetGaps {
  failedLetters: string[];
  failedLists: boolean;
  /** Drinks whose ingredients couldn't be loaded, so they can't be matched. */
  missingDetails: number;
}

const NO_GAPS: CabinetGaps = {
  failedLetters: [],
  failedLists: false,
  missingDetails: 0,
};

type CabinetState = {
  /** Every recipe with full ingredient data, from all sources. */
  recipes: Recipe[];
  status: LoadStatus;
  gaps: CabinetGaps;
};

export function hasGaps(gaps: CabinetGaps): boolean {
  return !!(
    gaps.failedLetters.length ||
    gaps.failedLists ||
    gaps.missingDetails
  );
}

export const CabinetStore = signalStore(
  withState<CabinetState>({ recipes: [], status: 'idle', gaps: NO_GAPS }),
  withMethods(
    (
      store,
      repository = inject(DrinkRepository),
      isBrowser = isPlatformBrowser(inject(PLATFORM_ID))
    ) => ({
      /**
       * Loads the same catalogue as the Drinks page, with every drink's ingredients
       * (drinks only the browse lists name are looked up), so matching sees every drink
       * we can reach. Cached for the session, so coming back from a drink is instant.
       * Browser only: it's dozens of requests, too slow for server rendering.
       */
      load: rxMethod<void>(
        pipe(
          switchMap(() => {
            if (!isBrowser) return EMPTY;
            patchState(store, { status: 'loading', gaps: NO_GAPS });
            return repository.detailedCatalogue().pipe(
              tapResponse({
                next: ({
                  recipes,
                  failedLetters,
                  failedLists,
                  missingDetails,
                }) => {
                  const gaps = { failedLetters, failedLists, missingDetails };
                  // Nothing at all from TheCocktailDB is an outage, not a partial list.
                  const nothing =
                    hasGaps(gaps) &&
                    !recipes.some(
                      r => r.source === 'cocktaildb' && r.hasDetails
                    );
                  patchState(
                    store,
                    nothing
                      ? { recipes: [], status: 'error', gaps: NO_GAPS }
                      : { recipes, status: 'ready', gaps }
                  );
                },
                // Drop what was loaded so a failure never shows stale results.
                error: () =>
                  patchState(store, {
                    recipes: [],
                    status: 'error',
                    gaps: NO_GAPS,
                  }),
              })
            );
          })
        )
      ),
    })
  )
);
