import { DEFAULT_SPIRITS } from '../data/spirit-taxonomy';
import {
  VENUE_MENU_DRINKS,
  VenueMenuDrink,
} from '../data/venue-menu/venue-menu.data';
import { fromVenueMenu } from '../data/venue-menu/venue-menu.source';
import { Recipe } from '../models/recipe.model';
import { requireRealVenueMenu } from '../testing/venue-menu.testing';
import {
  drinkLabel,
  isAlcoholFree,
  matchesType,
  spiritIngredient,
} from './drink-filters';

const spirit = (id: string) => DEFAULT_SPIRITS.find(s => s.id === id)!;

// Fictional menu drinks. The brand words (Camino, Dewar's, Bacardi, Sober) are the
// ones the spirit rules recognise; everything else is made up.
const fixture = (
  name: string,
  kind: VenueMenuDrink['kind'],
  ingredients: string[]
): VenueMenuDrink => ({
  id: `bg-menu-test-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`,
  name,
  section: 'Test Section',
  kind,
  ingredients,
  flavourNotes: [],
});
const menu = [
  fixture('Test Agave Lantern', 'cocktail', ['Camino Blanco', 'blood orange']),
  fixture('Test Golden Spritz', 'cocktail', ['Camino Gold', 'soda']),
  fixture('Test Tequila Smash', 'cocktail', ['tequila', 'basil']),
  fixture('Test Harbour Highball', 'cocktail', [
    "Dewar's White Label",
    'ginger ale',
  ]),
  fixture('Test Sesame Sour', 'cocktail', ['sesame whiskey', 'lemon']),
  fixture('Test Midnight Ferry', 'cocktail', ['Bacardi Carta Blanca', 'lime']),
  fixture('Test Copper Harbour', 'cocktail', ['dark rum', 'cola']),
  fixture('Test Juniper Field', 'cocktail', ['gin', 'elderflower']),
  fixture('Test Pink Cloud Tonic', 'zero_proof', ['Sober pink gin', 'tonic']),
  fixture('Test Quiet Isle', 'zero_proof', ['non-alcoholic rum', 'pineapple']),
  fixture('Test Orchard Cooler', 'mocktail', ['apple juice', 'mint']),
].map(fromVenueMenu);
const withSpirit = (id: string) =>
  menu.filter(r => spiritIngredient(r, spirit(id))).map(r => r.name);
const recipe = (names: string[]): Recipe => ({
  id: 'x',
  source: 'cocktaildb',
  credit: '',
  name: 'x',
  ingredients: names.map(name => ({ name })),
  translations: [],
  hasDetails: true,
});

describe('drink filters with menu drinks', () => {
  it('counts branded spirits from the menu under the right spirit', () => {
    expect(withSpirit('tequila')).toEqual(
      jasmine.arrayWithExactContents([
        'Test Agave Lantern',
        'Test Golden Spritz',
        'Test Tequila Smash',
      ])
    );
    expect(withSpirit('whiskey')).toContain('Test Harbour Highball'); // Dewar's White Label
    expect(withSpirit('whiskey')).toContain('Test Sesame Sour'); // sesame whiskey
    expect(withSpirit('rum')).toEqual(
      jasmine.arrayWithExactContents([
        'Test Midnight Ferry',
        'Test Copper Harbour',
      ])
    );
  });

  it('never counts alcohol-free spirits as gin or rum', () => {
    expect(withSpirit('gin')).not.toContain('Test Pink Cloud Tonic');
    expect(withSpirit('rum')).not.toContain('Test Quiet Isle');
    expect(withSpirit('gin')).toContain('Test Juniper Field'); // real gin still counts
    expect(withSpirit('gin')).not.toContain('Test Harbour Highball'); // ginger ale
    expect(isAlcoholFree('Sober pink gin')).toBeTrue();
    expect(isAlcoholFree('non-alcoholic rum')).toBeTrue();
    expect(isAlcoholFree('Alcohol-free gin')).toBeTrue();
    expect(isAlcoholFree('Gin')).toBeFalse();
    expect(isAlcoholFree('Light rum')).toBeFalse();
  });

  it('leaves TheCocktailDB-style ingredients as they were', () => {
    expect(
      spiritIngredient(recipe(['Ginger ale', 'Lime']), spirit('gin'))
    ).toBeUndefined();
    expect(spiritIngredient(recipe(['Light rum', 'Lime']), spirit('rum'))).toBe(
      'Light rum'
    );
    expect(
      spiritIngredient(recipe(['Cherry brandy']), spirit('brandy'))
    ).toBeUndefined();
    expect(
      spiritIngredient(recipe(['Blended Scotch']), spirit('whiskey'))
    ).toBe('Blended Scotch');
  });

  it('files zero-proof drinks under mocktails, never cocktails', () => {
    const zero = menu.filter(r => r.style === 'zero-proof');
    expect(zero.length).toBe(2);
    for (const r of zero) {
      expect(matchesType(r, 'mocktail')).toBeTrue();
      expect(matchesType(r, 'cocktail')).toBeFalse();
      expect(drinkLabel(r)).toBe('Zero-proof cocktail');
    }
    expect(menu.filter(r => matchesType(r, 'cocktail')).length).toBe(8);
    expect(menu.filter(r => matchesType(r, 'mocktail')).length).toBe(3);
    expect(drinkLabel({ kind: 'mocktail' })).toBe('Mocktail');
    expect(drinkLabel({ kind: 'optional' })).toBe('Optional alcohol');
  });

  // The published menu data, checked by count and by rule rather than by drink name.
  describe('on the menu data', () => {
    requireRealVenueMenu();
    // The original 39-drink dataset; drinks added later aren't counted here.
    const data = VENUE_MENU_DRINKS.slice(0, 39).map(fromVenueMenu);
    const counted = (id: string) =>
      data.filter(r => spiritIngredient(r, spirit(id)));
    const mentioning = (pattern: RegExp) =>
      data.filter(r => r.ingredients.some(i => pattern.test(i.name)));

    it('counts its branded spirits under the right spirit', () => {
      expect(counted('tequila').length).toBe(6);
      expect(counted('rum').length).toBe(3);
      const camino = mentioning(/camino/i);
      expect(camino.length).toBe(6);
      for (const r of camino) expect(counted('tequila')).toContain(r);
      const whiskeys = mentioning(/dewar|sesame whiskey/i);
      expect(whiskeys.length).toBeGreaterThan(0);
      for (const r of whiskeys) expect(counted('whiskey')).toContain(r);
    });

    it('never counts its alcohol-free spirits as gin or rum, but counts real gin', () => {
      const alcoholFree = data.filter(r =>
        r.ingredients.some(i => isAlcoholFree(i.name))
      );
      expect(alcoholFree.length).toBe(3);
      for (const r of alcoholFree) {
        expect(counted('gin')).not.toContain(r);
        expect(counted('rum')).not.toContain(r);
      }
      const realGin = mentioning(/^gin$/i);
      expect(realGin.length).toBeGreaterThan(0);
      for (const r of realGin) expect(counted('gin')).toContain(r);
    });

    it('files its zero-proof drinks under mocktails', () => {
      expect(data.filter(r => r.style === 'zero-proof').length).toBe(5);
      expect(data.filter(r => matchesType(r, 'cocktail')).length).toBe(23);
      expect(data.filter(r => matchesType(r, 'mocktail')).length).toBe(16);
    });
  });
});
