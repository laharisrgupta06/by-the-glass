import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { DrinkKind, Recipe } from '../../models/recipe.model';
import { refineNameMatches, startsWithLetter } from '../../utils/drink-filters';
import { DrinkSource } from '../drink-source';
import { describeMenuDrink } from '../../utils/describe-drink';
import {
  VENUE_MENU_DRINKS,
  VENUE_MENU_TRANSCRIBED_ON,
  VenueMenuDrink,
} from './venue-menu.data';

/**
 * The off switch for the venue-menu drinks. Defaults to environment.venueMenu, which
 * is on for development builds only.
 */
export const VENUE_MENU_ENABLED = new InjectionToken<boolean>(
  'venue-menu-enabled',
  { providedIn: 'root', factory: () => environment.venueMenu }
);

export const VENUE_MENU_CREDIT = 'a user-supplied venue menu transcription';

// Zero-proof drinks are non-alcoholic, so they filter as mocktails.
const KINDS: Record<VenueMenuDrink['kind'], DrinkKind> = {
  cocktail: 'cocktail',
  mocktail: 'mocktail',
  zero_proof: 'mocktail',
};

/**
 * A menu listing as a Recipe flagged 'menu-description'. Only what the menu says is
 * kept: no measures, method, glass, garnish, servings or photo. The description is one
 * sentence built from the menu's own flavour notes and ingredients.
 */
export function fromVenueMenu(drink: VenueMenuDrink): Recipe {
  return {
    id: drink.id,
    source: 'venue-menu',
    credit: VENUE_MENU_TRANSCRIBED_ON
      ? `${VENUE_MENU_CREDIT} (${VENUE_MENU_TRANSCRIBED_ON})`
      : VENUE_MENU_CREDIT,
    name: drink.name,
    kind: KINDS[drink.kind],
    style: drink.kind === 'zero_proof' ? 'zero-proof' : undefined,
    category: drink.section,
    ingredients: drink.ingredients.map(name => ({ name })),
    flavours: [...drink.flavourNotes],
    description: describeMenuDrink(drink),
    translations: [],
    hasDetails: true,
    completeness: 'menu-description',
  };
}

/** Drinks listed on a venue menu. Static data, so every lookup is synchronous. */
@Injectable({ providedIn: 'root' })
export class VenueMenuSource implements DrinkSource {
  private recipes: Recipe[] = inject(VENUE_MENU_ENABLED)
    ? VENUE_MENU_DRINKS.map(fromVenueMenu)
    : [];

  browse(): Observable<Recipe[]> {
    return of(this.recipes);
  }

  byLetter(letter: string): Observable<Recipe[]> {
    return of(this.recipes.filter(recipe => startsWithLetter(recipe, letter)));
  }

  searchByName(query: string): Observable<Recipe[]> {
    return of(refineNameMatches(this.recipes, query));
  }

  detailed(): Observable<Recipe[]> {
    return of(this.recipes);
  }

  byId(id: string): Observable<Recipe | undefined> {
    return of(this.recipes.find(recipe => recipe.id === id));
  }
}
