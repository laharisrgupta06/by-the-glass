import { Recipe } from '../../products/models/recipe.model';
import { VENUE_MENU_DRINKS } from '../../products/data/venue-menu/venue-menu.data';
import { fromVenueMenu } from '../../products/data/venue-menu/venue-menu.source';
import {
  RECENT_SURPRISES,
  pickSurprise,
  surpriseKey,
  surprisePool,
} from './surprise';

let nextId = 1;
function recipe(name: string, extra: Partial<Recipe> = {}): Recipe {
  return {
    id: String(nextId++),
    source: 'cocktaildb',
    credit: 'TheCocktailDB',
    name,
    kind: 'cocktail',
    image: 'https://example.com/drink.jpg',
    ingredients: [
      { name: 'Gin', measure: '2 oz' },
      { name: 'Lime juice', measure: '1 oz' },
      { name: 'Sugar syrup', measure: '1/2 oz' },
    ],
    instructions: 'Shake with ice, strain into a chilled glass and serve.',
    translations: [],
    hasDetails: true,
    ...extra,
  };
}

describe('Surprise Me', () => {
  const gimlet = recipe('Gimlet');
  const shirley = recipe('Shirley Temple', { kind: 'mocktail' });
  const punch = recipe('Punch', { kind: 'optional' });

  describe('pool', () => {
    it('filters by type the same way as the Drinks page', () => {
      const all = [gimlet, shirley, punch];
      expect(surprisePool(all, 'cocktail').map(r => r.name)).toEqual([
        'Gimlet',
        'Punch',
      ]);
      expect(surprisePool(all, 'mocktail').map(r => r.name)).toEqual([
        'Shirley Temple',
        'Punch',
      ]);
      expect(surprisePool(all, 'both').length).toBe(3);
    });

    it('reuses the quality rules, so incomplete recipes are never picked', () => {
      const pool = surprisePool(
        [
          recipe('List Only', { hasDetails: false }),
          recipe('Straight Gin', {
            ingredients: [{ name: 'Gin', measure: '2 oz' }],
          }),
          recipe('No Method', { instructions: '' }),
          recipe('Unmeasured', {
            ingredients: [
              { name: 'Gin' },
              { name: 'Tonic water' },
              { name: 'Lime' },
            ],
          }),
          recipe('Gimlet'), // duplicate name of a kept drink
          gimlet,
        ],
        'both'
      );
      expect(pool.map(r => r.name)).toEqual(['Gimlet']);
    });

    it('needs a photo to show', () => {
      expect(
        surprisePool([recipe('No Photo', { image: undefined })], 'both')
      ).toEqual([]);
    });
  });

  describe('pick', () => {
    const pool = Array.from({ length: 5 }, (_, i) => recipe(`Drink ${i}`));

    it('returns undefined for an empty pool', () => {
      expect(pickSurprise([])).toBeUndefined();
    });

    it('uses the random source across the whole pool', () => {
      expect(pickSurprise(pool, [], () => 0)).toBe(pool[0]);
      expect(pickSurprise(pool, [], () => 0.99)).toBe(pool[4]);
      expect(pickSurprise(pool, [], () => 1)).toBe(pool[4]);
    });

    it('does not repeat recent picks while others remain', () => {
      const recent = pool.slice(0, 4).map(surpriseKey);
      expect(pickSurprise(pool, recent, () => 0)).toBe(pool[4]);
    });

    it('always offers "another" different from the current one', () => {
      const pair = pool.slice(0, 2);
      const current = surpriseKey(pair[0]);
      for (const r of [0, 0.5, 0.99])
        expect(pickSurprise(pair, [current], () => r)).toBe(pair[1]);
    });

    it('repeats rather than failing when the pool has one drink', () => {
      expect(pickSurprise([gimlet], [surpriseKey(gimlet)])).toBe(gimlet);
    });

    it('only remembers a limited number of recent picks', () => {
      const big = Array.from({ length: RECENT_SURPRISES + 2 }, (_, i) =>
        recipe(`Big ${i}`)
      );
      const recent = big.map(surpriseKey); // every drink was recent once
      // The oldest two fall outside the window and can be picked again.
      expect(pickSurprise(big, recent, () => 0)).toBe(big[0]);
    });
  });

  it('never picks a venue-menu drink, even one given a photo and a method', () => {
    const menu = VENUE_MENU_DRINKS.map(fromVenueMenu);
    for (const type of ['both', 'cocktail', 'mocktail'] as const)
      expect(surprisePool(menu, type)).toEqual([]);
    // Belt and braces: completeness alone excludes it.
    const dressedUp = {
      ...menu[0],
      image: 'x.jpg',
      instructions: 'Shake with ice and strain into a glass.',
    };
    expect(surprisePool([dressedUp], 'both')).toEqual([]);
  });
});
