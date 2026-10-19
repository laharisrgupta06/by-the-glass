import {
  VENUE_MENU_DRINKS,
  VenueMenuDrink,
  VenueMenuKind,
} from '../data/venue-menu/venue-menu.data';

/**
 * Helpers for specs that involve venue-menu drinks. Only imported by specs.
 *
 * The published menu is venue-menu.data.ts. Behavioural tests swap fictional drinks in
 * (useVenueMenu) so they don't depend on its contents.
 */

/** Whether the published venue menu has any drinks (checked before any swap). */
export const REAL_VENUE_MENU_PRESENT = VENUE_MENU_DRINKS.length > 0;

/**
 * For checks of the published menu data itself. The menu is part of the repository,
 * so it must be there: if it's ever emptied by mistake, these checks fail rather than
 * passing against no data.
 */
export function requireRealVenueMenu(): void {
  beforeEach(() => {
    expect(REAL_VENUE_MENU_PRESENT)
      .withContext('The published venue menu (venue-menu.data.ts) is empty.')
      .toBeTrue();
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
