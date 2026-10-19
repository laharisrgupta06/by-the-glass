/**
 * Production stand-in for venue-menu.data.ts (see angular.json fileReplacements).
 * Permission to republish the venue menu hasn't been confirmed, so its text must not
 * ship in production builds.
 *
 * The types are repeated here rather than imported: in a production build this file
 * replaces venue-menu.data.ts, so importing from it would import this file itself.
 * Keep them in step with venue-menu.data.ts.
 */

export type VenueMenuKind = 'cocktail' | 'mocktail' | 'zero_proof';

export interface VenueMenuDrink {
  id: string;
  name: string;
  section: string;
  kind: VenueMenuKind;
  ingredients: string[];
  flavourNotes: string[];
}

export const VENUE_MENU_TRANSCRIBED_ON = '';

export const VENUE_MENU_DRINKS: VenueMenuDrink[] = [];
