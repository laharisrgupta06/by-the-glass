import { mentionsPrice } from 'src/app/core/ai/ai-recipe';
import { VENUE_MENU_DRINKS } from '../data/venue-menu/venue-menu.data';
import { Recipe } from '../models/recipe.model';
import { requireRealVenueMenu } from '../testing/venue-menu.testing';
import { describeCatalogueDrink, describeMenuDrink } from './describe-drink';

type Drink = Pick<Recipe, 'kind' | 'category' | 'glass' | 'ingredients'>;
const drink = (
  kind: Drink['kind'],
  category: string,
  glass: string,
  ingredients: string[]
): Drink => ({
  kind,
  category,
  glass,
  ingredients: ingredients.map(name => ({ name })),
});

describe('drink descriptions', () => {
  it('describes TheCocktailDB drinks from their own data, in plain words', () => {
    expect(
      describeCatalogueDrink(
        drink('cocktail', 'Ordinary Drink', 'Cocktail glass', [
          'Tequila',
          'Triple sec',
          'Lime juice',
          'Salt',
        ])
      )
    ).toBe(
      'A sour tequila cocktail with triple sec, lime juice and salt, served in a cocktail glass.'
    );
    expect(
      describeCatalogueDrink(
        drink('cocktail', 'Cocktail', 'Highball glass', [
          'Light rum',
          'Lime',
          'Sugar',
          'Mint',
          'Soda water',
        ])
      )
    ).toBe(
      'A sweet-and-sour, sparkling light rum cocktail with lime, sugar and mint, served in a highball glass.'
    );
    expect(
      describeCatalogueDrink(
        drink('cocktail', 'Ordinary Drink', 'Old-fashioned glass', [
          'Gin',
          'Campari',
          'Sweet Vermouth',
        ])
      )
    ).toBe(
      'A bitter gin cocktail with Campari and sweet vermouth, served in an old-fashioned glass.'
    );
  });

  it('keeps brand names, lowers everything else, and names drinks by their category', () => {
    expect(
      describeCatalogueDrink(
        drink('cocktail', 'Ordinary Drink', 'Highball Glass', [
          'Light rum',
          'Lime',
          'Coca-Cola',
        ])
      )
    ).toBe(
      'A sparkling, sour light rum cocktail with lime and Coca-Cola, served in a highball glass.'
    );
    expect(
      describeCatalogueDrink(
        drink('mocktail', 'Shake', 'Highball Glass', [
          'Milk',
          'Banana',
          'Honey',
        ])
      )
    ).toBe(
      'A creamy, sweet shake of milk, banana and honey, served in a highball glass.'
    );
    expect(
      describeCatalogueDrink(
        drink('cocktail', 'Coffee / Tea', 'Irish coffee cup', [
          'Irish whiskey',
          'Coffee',
          'Sugar',
          'Whipped cream',
        ])
      )
    ).toBe(
      'A creamy, sweet Irish whiskey coffee drink with sugar and whipped cream, served in an Irish coffee cup.'
    );
  });

  it('says nothing when there is no ingredient data, and never invents', () => {
    expect(
      describeCatalogueDrink(drink('cocktail', 'Cocktail', '', []))
    ).toBeUndefined();
    expect(
      describeCatalogueDrink(
        drink('mocktail', 'Other / Unknown', '', ['Berries', 'Apple'])
      )
    ).toBe('A non-alcoholic drink of berries and apple.');
  });

  it('describes every venue drink from the menu’s own notes and ingredients', () => {
    // Fictional drinks: the sentence is built from exactly what's given, brands as written.
    expect(
      describeMenuDrink({
        kind: 'cocktail',
        flavourNotes: ['smoky', 'earthy'],
        ingredients: [
          'Fernhollow Dark',
          'cold brew',
          'vanilla syrup',
          'oat cream',
        ],
      })
    ).toBe(
      'A smoky, earthy cocktail of Fernhollow Dark, cold brew, vanilla syrup and oat cream.'
    );
    expect(
      describeMenuDrink({
        kind: 'zero_proof',
        flavourNotes: ['spicy', 'fruity'],
        ingredients: ['Fernhollow zero rum', 'blackcurrant spice mix'],
      })
    ).toBe(
      'A spicy, fruity zero-proof cocktail of Fernhollow zero rum and blackcurrant spice mix.'
    );
  });

  // The real menu data: skipped, and reported as such, where it's absent.
  describe('on the menu data', () => {
    requireRealVenueMenu();

    it('describes every drink distinctly, naming every ingredient and never a price', () => {
      const all = VENUE_MENU_DRINKS.map(describeMenuDrink);
      expect(all.length).toBe(39);
      expect(new Set(all).size).toBe(39);
      for (const [i, description] of all.entries()) {
        for (const ingredient of VENUE_MENU_DRINKS[i].ingredients)
          expect(description).toContain(ingredient);
        expect(mentionsPrice(description)).toBeFalse();
      }
    });
  });
});
