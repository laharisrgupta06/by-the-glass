import { requireRealVenueMenu } from '../../testing/venue-menu.testing';
import { VENUE_MENU_DRINKS } from './venue-menu.data';

// Fixed forever: favourites and links depend on these ids, so changing, adding,
// removing or reordering one is a breaking change. They're pinned by a digest so the
// real drink names stay out of this file: SHA-256 of the 39 ids, in order, one per line.
const PINNED_IDS_SHA256 =
  '5543cc54c0852afea37cbbb9b2062d74e9220a25784ee8f7f893a9f3050a1dac';

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(digest), b =>
    b.toString(16).padStart(2, '0')
  ).join('');
}

// Field names that would mean a price had crept in.
const PRICE_KEY = /price|cost|inr|mrp|currency|amount|rate|tariff/i;
// A currency marker next to a number, in any value. Plain numbers (e.g. "2.0") are fine.
const PRICE_VALUE = /(₹|\brs\.?\s*\d|\binr\b|\$\s*\d|€\s*\d|£\s*\d)/i;

// Checks of the real menu data: skipped, and reported as such, where it's absent.
describe('venue menu data', () => {
  requireRealVenueMenu();

  it('has the 39 drinks from the dataset, with their fixed ids', async () => {
    expect(VENUE_MENU_DRINKS.length).toBe(39);
    const ids = VENUE_MENU_DRINKS.map(d => d.id);
    expect(await sha256(ids.join('\n')))
      .withContext('the pinned venue-menu ids changed')
      .toBe(PINNED_IDS_SHA256);
  });

  it('uses short, safe, unique ids that can never collide with TheCocktailDB ids', () => {
    for (const { id } of VENUE_MENU_DRINKS) {
      expect(id).toMatch(/^bg-menu-[a-z0-9-]+$/);
      expect(id.length).toBeLessThanOrEqual(64); // Firestore rules limit
    }
    expect(new Set(VENUE_MENU_DRINKS.map(d => d.id)).size).toBe(39);
  });

  it('contains no prices or price fields', () => {
    for (const drink of VENUE_MENU_DRINKS) {
      expect(Object.keys(drink).sort()).toEqual(
        ['flavourNotes', 'id', 'ingredients', 'kind', 'name', 'section'].sort()
      );
      for (const key of Object.keys(drink)) expect(key).not.toMatch(PRICE_KEY);
      const values = [
        drink.name,
        drink.section,
        drink.kind,
        ...drink.ingredients,
        ...drink.flavourNotes,
      ];
      for (const value of values) {
        expect(typeof value).toBe('string');
        expect(value).not.toMatch(PRICE_VALUE);
      }
    }
  });

  it('allows ordinary numbers in names', () => {
    // At least one listed name has a version number in it, kept as written.
    expect(VENUE_MENU_DRINKS.some(d => /\d\.\d/.test(d.name))).toBeTrue();
  });

  it('keeps every listing complete enough to show', () => {
    for (const drink of VENUE_MENU_DRINKS) {
      expect(['cocktail', 'mocktail', 'zero_proof']).toContain(drink.kind);
      expect(drink.name.trim()).toBe(drink.name);
      expect(drink.ingredients.length).toBeGreaterThan(0);
      expect(drink.ingredients.every(i => i.trim().length > 0)).toBeTrue();
      expect(drink.flavourNotes.length).toBeGreaterThan(0);
    }
    const kinds = VENUE_MENU_DRINKS.map(d => d.kind);
    expect(kinds.filter(k => k === 'cocktail').length).toBe(23);
    expect(kinds.filter(k => k === 'mocktail').length).toBe(11);
    expect(kinds.filter(k => k === 'zero_proof').length).toBe(5);
  });
});

describe('venue menu production stand-in', () => {
  it('is empty, and its types stay in step with the real data file', async () => {
    const stub = await import('./venue-menu.data.disabled');
    expect(stub.VENUE_MENU_DRINKS).toEqual([]);
    expect(stub.VENUE_MENU_TRANSCRIBED_ON).toBe('');
    // Compile-time check: each drink type must be assignable to the other.
    const real: import('./venue-menu.data').VenueMenuDrink =
      VENUE_MENU_DRINKS[0];
    const asStub: import('./venue-menu.data.disabled').VenueMenuDrink = real;
    const back: import('./venue-menu.data').VenueMenuDrink = asStub;
    expect(back).toBe(real);
  });
});
