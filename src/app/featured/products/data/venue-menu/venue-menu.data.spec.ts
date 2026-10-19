import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { requireRealVenueMenu } from '../../testing/venue-menu.testing';
import { VENUE_MENU_DRINKS } from './venue-menu.data';
import { VENUE_MENU_ENABLED, VenueMenuSource } from './venue-menu.source';

// Fixed forever: favourites and links depend on these ids. The original 39, in order;
// new drinks are appended after them, and none of these may change or disappear.
const PINNED_IDS = [
  'bg-menu-patiala-balance',
  'bg-menu-bombae-rita',
  'bg-menu-kokum-kick',
  'bg-menu-spice-route',
  'bg-menu-coconut-cartel',
  'bg-menu-susegad-sling',
  'bg-menu-mez-and-mace',
  'bg-menu-malabar-mood',
  'bg-menu-aamrakhand-old-fashioned',
  'bg-menu-bengal-summer',
  'bg-menu-pandan-pour',
  'bg-menu-peru-picante',
  'bg-menu-smoked-murabba',
  'bg-menu-til-gud-martini',
  'bg-menu-kairi-thecha-picante',
  'bg-menu-spiced-imli-margarita',
  'bg-menu-memsaabs-favourite-pink-gin',
  'bg-menu-nutty-port-manhattan',
  'bg-menu-peach-julep',
  'bg-menu-hibiscus-paloma',
  'bg-menu-after-hours',
  'bg-menu-pom-sbagliato',
  'bg-menu-the-slow-sundown',
  'bg-menu-grapefruit-g-and-t',
  'bg-menu-jamun-daiquiri',
  'bg-menu-lychee-g-and-t',
  'bg-menu-amber-highball',
  'bg-menu-pom-and-passion',
  'bg-menu-sober-bomba-e',
  'bg-menu-kairi-sherbet-2-0',
  'bg-menu-old-town-cooler',
  'bg-menu-peru-mary',
  'bg-menu-phool-berries',
  'bg-menu-tropical-ananas',
  'bg-menu-masala-cola',
  'bg-menu-kairi-sherbet',
  'bg-menu-mango-lassi',
  'bg-menu-buttery-santra-biscuit',
  'bg-menu-banana-and-kiwi-milkshake',
];

// Field names that would mean a price had crept in.
const PRICE_KEY = /price|cost|inr|mrp|currency|amount|rate|tariff/i;
// A currency marker next to a number, in any value. Plain numbers (e.g. "2.0") are fine.
const PRICE_VALUE = /(₹|\brs\.?\s*\d|\binr\b|\$\s*\d|€\s*\d|£\s*\d)/i;

// The published menu data itself.
describe('venue menu data', () => {
  requireRealVenueMenu();

  it('keeps the 39 drinks from the dataset first, with their fixed ids', () => {
    expect(VENUE_MENU_DRINKS.length).toBeGreaterThanOrEqual(39);
    expect(VENUE_MENU_DRINKS.slice(0, 39).map(d => d.id)).toEqual(PINNED_IDS);
  });

  it('uses short, safe, unique ids that can never collide with TheCocktailDB ids', () => {
    for (const { id } of VENUE_MENU_DRINKS) {
      expect(id).toMatch(/^bg-menu-[a-z0-9-]+$/);
      expect(id.length).toBeLessThanOrEqual(64); // Firestore rules limit
    }
    const ids = VENUE_MENU_DRINKS.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
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
    expect(
      VENUE_MENU_DRINKS.some(d => d.name === 'Kairi Sherbet 2.0')
    ).toBeTrue();
  });

  it('keeps every listing complete enough to show', () => {
    for (const drink of VENUE_MENU_DRINKS) {
      expect(['cocktail', 'mocktail', 'zero_proof']).toContain(drink.kind);
      expect(drink.name.trim()).toBe(drink.name);
      expect(drink.ingredients.length).toBeGreaterThan(0);
      expect(drink.ingredients.every(i => i.trim().length > 0)).toBeTrue();
      expect(drink.flavourNotes.length).toBeGreaterThan(0);
    }
    // The original dataset's mix; drinks added later aren't counted here.
    const kinds = VENUE_MENU_DRINKS.slice(0, 39).map(d => d.kind);
    expect(kinds.filter(k => k === 'cocktail').length).toBe(23);
    expect(kinds.filter(k => k === 'mocktail').length).toBe(11);
    expect(kinds.filter(k => k === 'zero_proof').length).toBe(5);
  });
});

describe('the published venue menu', () => {
  it('is switched on in production builds', () => {
    // Unit tests build with the production environment (environment.ts).
    expect(environment.venueMenu).toBeTrue();
    expect(TestBed.inject(VENUE_MENU_ENABLED)).toBeTrue();
  });

  it('serves every drink in the menu data, by default', async () => {
    const menu = TestBed.inject(VenueMenuSource);
    const drinks = await firstValueFrom(menu.browse());
    expect(drinks.length).toBe(VENUE_MENU_DRINKS.length);
    expect(drinks.map(d => d.id)).toEqual(VENUE_MENU_DRINKS.map(d => d.id));
    expect((await firstValueFrom(menu.byId('bg-menu-after-hours')))?.name).toBe(
      'After Hours'
    );
  });
});
