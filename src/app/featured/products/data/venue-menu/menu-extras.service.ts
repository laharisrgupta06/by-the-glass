import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { toFailure } from 'src/app/core/ai/ai-failure';
import {
  MENU_PATHS,
  MenuExtras,
  MenuIllustration,
  StoredMenuRecipe,
  sanitizeAiRecipe,
} from 'src/app/core/ai/ai-recipe';

/** A stored menu recipe, checked again in the browser; anything off is dropped. */
export function checkMenuRecipe(raw: unknown): StoredMenuRecipe | null {
  if (!raw || typeof raw !== 'object') return null;
  const stored = raw as StoredMenuRecipe;
  if (!Array.isArray(stored.menuIngredients)) return null;
  const result = sanitizeAiRecipe(stored.recipe, {
    given: stored.menuIngredients,
    requireAllGiven: true,
    alcoholCheck: 'extras',
  });
  return result.ok ? { ...stored, recipe: result.recipe } : null;
}

function checkIllustration(raw: unknown): MenuIllustration | null {
  const data = (raw ?? {}) as Partial<MenuIllustration>;
  // Only our own API serves illustrations.
  return typeof data.url === 'string' && data.url.startsWith('/api/venue-menu/')
    ? {
        url: data.url,
        model: String(data.model ?? ''),
        createdAt: String(data.createdAt ?? ''),
      }
    : null;
}

/**
 * AI-curated recipes and AI-generated illustrations for venue-menu drinks, from our
 * own server (never Gemini directly). Only ever asked about venue-menu drinks.
 */
@Injectable({ providedIn: 'root' })
export class MenuExtrasService {
  private http = inject(HttpClient);

  extras(drinkId: string): Observable<MenuExtras> {
    return this.http.get<unknown>(MENU_PATHS.extras(drinkId)).pipe(
      map(raw => {
        const data = (raw ?? {}) as Record<string, unknown>;
        return {
          recipe: checkMenuRecipe(data['recipe']),
          illustration: checkIllustration(data['illustration']),
          canCreateRecipe: data['canCreateRecipe'] === true,
        };
      }),
      catchError(error => throwError(() => toFailure(error)))
    );
  }

  /** Creates the recipe once; asking again returns the stored one. */
  createRecipe(drinkId: string): Observable<StoredMenuRecipe> {
    return this.http.post<unknown>(MENU_PATHS.recipe(drinkId), {}).pipe(
      map(raw => {
        const recipe = checkMenuRecipe(raw);
        if (!recipe) throw new Error('The recipe did not pass our checks.');
        return recipe;
      }),
      catchError(error => throwError(() => toFailure(error)))
    );
  }
}
