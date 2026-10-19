import {
  VENUE_MENU_DRINKS,
  VenueMenuDrink,
  VenueMenuKind,
} from '../data/venue-menu/venue-menu.data';

/**
 * Helpers for specs that involve venue-menu drinks. Only imported by specs.
 *
 * Tests swap in venue-menu.data.local.ts (angular.json). On a machine with the real
 * menu that's the real data; in a fresh clone it's a copy of the empty placeholder.
 */

/** Whether the real venue menu is in this checkout (checked before any swap). */
export const REAL_VENUE_MENU_PRESENT = VENUE_MENU_DRINKS.length > 0;

/**
 * For checks of the real menu data itself. Where it's absent, each test in the
 * enclosing describe is reported as skipped, with the reason, rather than passing
 * against no data.
 */
export function requireRealVenueMenu(): void {
  beforeEach(() => {
    if (!REAL_VENUE_MENU_PRESENT)
      pending(
        'Needs the real venue menu (venue-menu.data.local.ts), which isn’t in this checkout.'
      );
  });
}

/**
 * Swaps fictional drinks in for the menu data during each test in the enclosing
 * describe, then puts the real data back. Code that reads the menu when it's created
 * (e.g. VenueMenuSource) then sees only these drinks.
 */
export function useVenueMenu(drinks: VenueMenuDrink[]): void {
  let saved: VenueMenuDrink[] = [];
  beforeEach(() => {
    saved = VENUE_MENU_DRINKS.splice(0, Infinity, ...drinks);
  });
  afterEach(() => {
    VENUE_MENU_DRINKS.splice(0, Infinity, ...saved);
  });
}

/** A fictional menu drink; the id is derived from the name, as the real ones were. */
export function testVenueDrink(
  name: string,
  kind: VenueMenuKind,
  ingredients: string[],
  flavourNotes: string[] = [],
  section = 'Test Section'
): VenueMenuDrink {
  const slug = name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return {
    id: `bg-menu-test-${slug}`,
    name,
    section,
    kind,
    ingredients,
    flavourNotes,
  };
}
