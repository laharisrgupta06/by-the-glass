import { Recipe } from '../models/recipe.model';
import { curate, qualityIssues } from './recipe-quality';
import {
  requireRealVenueMenu,
  testVenueDrink,
} from '../testing/venue-menu.testing';
import { VENUE_MENU_DRINKS } from './venue-menu/venue-menu.data';
import { fromVenueMenu } from './venue-menu/venue-menu.source';

// Fictional menu drinks: listed ingredients only, no method or measures.
const TEST_MENU = [
  testVenueDrink('Test Lantern Sour', 'cocktail', ['gin', 'quince', 'lime']),
  testVenueDrink('Saffron Lassi', 'mocktail', ['saffron syrup', 'yoghurt']),
  testVenueDrink('Test Kelp Fizz', 'zero_proof', ['kelp cordial', 'soda']),
];

const cocktailDb = (name: string, extra: Partial<Recipe> = {}): Recipe => ({
  id: name,
  source: 'cocktaildb',
  credit: 'TheCocktailDB',
  name,
  ingredients: [
    { name: 'Gin', measure: '2 oz' },
    { name: 'Lime juice', measure: '1 oz' },
    { name: 'Sugar syrup', measure: '1/2 oz' },
  ],
  instructions: 'Shake with ice and strain into a chilled glass.',
  translations: [],
  hasDetails: true,
  ...extra,
});

describe('recipe quality with menu descriptions', () => {
  it('keeps every menu description, though none has a method or measures', () => {
    const menu = TEST_MENU.map(fromVenueMenu);
    expect(menu.every(r => qualityIssues(r).length === 0)).toBeTrue();
    expect(curate(menu).recipes.length).toBe(3);
  });

  // The real menu data: skipped, and reported as such, where it's absent.
  describe('on the menu data', () => {
    requireRealVenueMenu();

    it('keeps all 39 menu descriptions', () => {
      const menu = VENUE_MENU_DRINKS.map(fromVenueMenu);
      expect(menu.every(r => qualityIssues(r).length === 0)).toBeTrue();
      expect(curate(menu).recipes.length).toBe(39);
    });
  });

  it('still hides incomplete TheCocktailDB recipes exactly as before', () => {
    expect(
      qualityIssues(cocktailDb('No Method', { instructions: '' }))
    ).toContain('no-method');
    const unmeasured = cocktailDb('Unmeasured', {
      ingredients: [{ name: 'Gin' }, { name: 'Tonic water' }, { name: 'Lime' }],
    });
    expect(qualityIssues(unmeasured)).toContain('no-measurements');
    expect(qualityIssues(cocktailDb('Fine'))).toEqual([]);
  });

  it('hides a menu description with no ingredients', () => {
    const empty = { ...fromVenueMenu(TEST_MENU[0]), ingredients: [] };
    expect(qualityIssues(empty)).toEqual(['single-ingredient']);
  });

  it('keeps a menu description and a recipe of the same name as separate entries, in either order', () => {
    const menu = { ...fromVenueMenu(TEST_MENU[0]), name: 'Gimlet' };
    const recipe = cocktailDb('Gimlet');
    for (const order of [
      [menu, recipe],
      [recipe, menu],
    ]) {
      const { recipes, hidden } = curate(order);
      expect(recipes).toEqual(order);
      expect(hidden).toBe(0);
    }
  });

  it('still merges two recipes that are the same drink', () => {
    const planters = cocktailDb('Planter’s Punch', { id: '178368' });
    const plain = cocktailDb("Planter's Punch", { id: '17191' });
    expect(curate([planters, plain]).recipes.length).toBe(1);
    const tonic = cocktailDb('Vodka Tonic', { id: '178364' });
    const andTonic = cocktailDb('Vodka And Tonic', { id: '12460' });
    expect(curate([tonic, andTonic]).recipes.length).toBe(1);
  });

  it('keeps menu drinks with similar, not identical, names separate', () => {
    const lassi = fromVenueMenu(TEST_MENU[1]);
    const kept = curate([lassi, cocktailDb('Lassi - Saffron')]).recipes;
    expect(kept.length).toBe(2);
  });
});
