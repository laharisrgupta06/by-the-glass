/**
 * Placeholder for the venue-menu drinks: tracked in Git, with no menu text.
 *
 * The real menu (transcribed from user-supplied menu photos; permission to republish
 * it hasn't been confirmed) lives only in venue-menu.data.local.ts, which Git ignores.
 * Development builds and tests swap that file in for this one (angular.json
 * fileReplacements); production builds swap in venue-menu.data.disabled.ts instead, so
 * the real menu never ships. A fresh clone gets a copy of this placeholder as its local
 * file (scripts/ensure-venue-menu-local.mjs), so it builds and tests with no menu
 * drinks.
 *
 * The types are repeated in each of these files rather than imported, because each one
 * stands in for this file. Keep them in step.
 */

export type VenueMenuKind = 'cocktail' | 'mocktail' | 'zero_proof';

export interface VenueMenuDrink {
  /** Fixed forever: favourites and links depend on it. */
  id: string;
  name: string;
  /** The menu section it's listed under. */
  section: string;
  kind: VenueMenuKind;
  /** As written on the menu, in order. */
  ingredients: string[];
  /** As written on the menu. */
  flavourNotes: string[];
}

export const VENUE_MENU_TRANSCRIBED_ON = '';

export const VENUE_MENU_DRINKS: VenueMenuDrink[] = [];
