import { InjectionToken, inject } from '@angular/core';

import { SPIRIT_TAXONOMY } from '../../products/data/spirit-taxonomy';

/**
 * Shelves for browsing ingredients on What Can I Make?. Our drinks source doesn't
 * categorise ingredients, so each one is placed by these rules: first by name
 * (`ingredients`), then by word, trying categories by `wordPriority`.
 * Anything left over goes under "Everything else", so no ingredient is ever hidden.
 * The curated dataset can provide its own categories through INGREDIENT_CATEGORIES.
 */
export interface IngredientCategory {
  id: string;
  label: string;
  /** Exact ingredient names. These win over every word rule. */
  ingredients?: string[];
  /** Whole words that place an ingredient here, e.g. "juice" or "syrup". */
  words?: string[];
  /**
   * Lower goes first when several categories' words match, so "Lime juice" is a juice
   * not a fruit, and "Coffee liqueur" a liqueur not a mixer.
   */
  wordPriority?: number;
}

export const OTHER_CATEGORY: IngredientCategory = {
  id: 'other',
  label: 'Everything else',
};

/** Tuned to TheCocktailDB's ingredient names; listed in the order they're shown. */
export function defaultCategories(spiritTerms: string[]): IngredientCategory[] {
  return [
    {
      id: 'spirits',
      wordPriority: 2,
      label: 'Spirits',
      // Named bottles that don't say what they are.
      ingredients: [
        'Absolut Citron',
        'Absolut Kurant',
        'Absolut Peppar',
        'Everclear',
        'Grain alcohol',
        'Jim Beam',
        'Johnnie Walker',
        'Crown Royal',
        'Wild Turkey',
      ],
      words: spiritTerms,
    },
    {
      id: 'alcohol-free',
      // Before every other rule: "Sober gin" names a spirit but contains none.
      wordPriority: 0,
      label: 'Alcohol-free spirits',
      ingredients: ['Sober gin', 'Sober pink gin', 'Sober rum'],
      words: ['sober', 'non alcoholic', 'alcohol free', 'zero proof'],
    },
    {
      id: 'liqueurs',
      wordPriority: 1,
      label: 'Liqueurs & aperitifs',
      // Sweetened or flavoured, even where the name says rum, gin or brandy.
      ingredients: [
        // Placed for the venue-menu drinks.
        'Coconut Campari',

        'Malibu rum',
        'Sloe gin',
        'Apricot brandy',
        'Blackberry brandy',
        'Cherry brandy',
        'Coffee brandy',
        'Peach brandy',
        'Cherry Heering',
        'Amaretto',
        'Kahlua',
        'Tia maria',
        'Baileys irish cream',
        'Irish cream',
        'Campari',
        'Aperol',
        'Galliano',
        'Frangelico',
        'Cointreau',
        'Grand Marnier',
        'Drambuie',
        'Benedictine',
        'Jägermeister',
        'Southern Comfort',
        'Yukon Jack',
        'Firewater',
        'Hot Damn',
        'Goldschlager',
        'Rumple Minze',
        'Apfelkorn',
        'Advocaat',
        'Anis',
        'Anisette',
        'Ouzo',
        'Pernod',
        'Ricard',
        'Passoa',
        'Pisang Ambon',
        'St. Germain',
        'Falernum',
        'Triple sec',
      ],
      words: [
        'liqueur',
        'schnapps',
        'curacao',
        'creme de',
        'chartreuse',
        'sambuca',
        'amaro',
      ],
    },
    {
      id: 'wine',
      wordPriority: 3,
      label: 'Wine, beer & vermouth',
      ingredients: [
        'Lillet',
        'Lillet Blanc',
        'Dubonnet Rouge',
        'Corona',
        'Guinness stout',
        'Zima',
      ],
      words: [
        'wine',
        'vermouth',
        'champagne',
        'prosecco',
        'port',
        'sherry',
        'beer',
        'lager',
        'cider',
      ],
    },
    {
      id: 'mixers',
      wordPriority: 8,
      label: 'Mixers',
      ingredients: [
        // Placed for the venue-menu drinks.
        'Cola',
        'Kairi sherbet',

        'Ginger ale',
        'Ginger beer',
        'Root beer',
        'Coca-Cola',
        'Pepsi Cola',
        '7-Up',
        'Sprite',
        'Dr. Pepper',
        'Mountain Dew',
        'Fresca',
        'Surge',
        'Sarsaparilla',
        'Schweppes Russchian',
        'Carbonated soft drink',
        'Bitter lemon',
        'Sweet and sour',
        'Fruit punch',
        'Kool-Aid',
        'Coffee',
        'Espresso',
        'Tea',
        'Iced tea',
        'Hot chocolate',
      ],
      words: ['soda', 'tonic', 'water', 'lemonade', 'limeade', 'mix'],
    },
    {
      id: 'juices',
      wordPriority: 4,
      label: 'Juices',
      words: ['juice', 'nectar'],
    },
    {
      id: 'fruit',
      wordPriority: 10,
      label: 'Fruit',
      ingredients: [
        // Placed for the venue-menu drinks.
        'Coconut',
        'Grapefruit',
        'Kokum',
        'Lychee',
        'Peach',
        'Pomegranate',
        'Strawberry',
        'Tamarind',
        'Tangerine',
        'Watermelon',
        'Berry purée',
      ],
      words: [
        'lime',
        'lemon',
        'orange',
        'apple',
        'banana',
        'cherry',
        'cherries',
        'kiwi',
        'mango',
        'papaya',
        'pineapple',
        'strawberries',
        'blackberries',
        'figs',
        'fruit',
      ],
    },
    {
      id: 'syrups',
      wordPriority: 6,
      label: 'Syrups & sweeteners',
      ingredients: [
        // Placed for the venue-menu drinks.
        'Smoked orange marmalade',
        'Chilli shrub',
        'Grenadine',
        'Cream of coconut',
      ],
      words: ['syrup', 'sugar', 'honey', 'cordial'],
    },
    {
      id: 'dairy',
      wordPriority: 7,
      label: 'Dairy & eggs',
      ingredients: [
        // Placed for the venue-menu drinks.
        'Brown butter',
        'Aamrakhand',
        'Butter',
        'Half-and-half',
      ],
      words: ['milk', 'cream', 'egg', 'yoghurt'],
    },
    {
      id: 'garnishes',
      wordPriority: 9,
      label: 'Herbs & garnishes',
      ingredients: [
        // Placed for the venue-menu drinks.
        'Curry leaf',
        'Lemongrass',
        'Mint leaves',
        'Hibiscus',
        'Makrut lime leaf',
        'Spiced foam',

        'Mint',
        'Rosemary',
        'Thyme',
        'Lavender',
        'Rose',
        'Wormwood',
        'Cucumber',
        'Olive',
        'Olive Brine',
      ],
      words: ['peel', 'spiral'],
    },
    {
      id: 'spices',
      wordPriority: 5,
      label: 'Spices, bitters & sauces',
      ingredients: [
        // Placed for the venue-menu drinks.
        'House spice mix',
        'Jamun spice mix',
        'Panchporan puree',
        'Teppal extract',
        'Chilli',
        'Jalapeños',
        'Coriander tincture',
        'Tabasco',
        'Hazelnut',
        'White chocolate',

        'Ginger',
        'Cinnamon',
        'Cloves',
        'Nutmeg',
        'Cardamom',
        'Allspice',
        'Coriander',
        'Cumin seed',
        'Asafoetida',
        'Red Chili Flakes',
        'Vanilla',
        'Vanilla extract',
        'Almond flavoring',
        'Cocoa powder',
        'Chocolate',
        'Caramel coloring',
      ],
      words: ['bitters', 'salt', 'pepper', 'sauce'],
    },
  ];
}

export const INGREDIENT_CATEGORIES = new InjectionToken<IngredientCategory[]>(
  'ingredient-categories',
  {
    providedIn: 'root',
    factory: () =>
      defaultCategories(inject(SPIRIT_TAXONOMY).flatMap(s => s.terms)),
  }
);
