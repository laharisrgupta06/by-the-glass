import { convertToParamMap } from '@angular/router';

import {
  DEFAULT_INGREDIENT_RULES as rules,
  ingredientKey,
} from '../../products/data/ingredient-rules';
import { DrinkKind, Recipe } from '../../products/models/recipe.model';
import { DEFAULT_SPIRITS } from '../../products/data/spirit-taxonomy';
import { defaultCategories } from '../data/ingredient-categories';
import { DEFAULT_TASTES } from '../data/taste-signals';
import { VENUE_MENU_DRINKS } from '../../products/data/venue-menu/venue-menu.data';
import { fromVenueMenu } from '../../products/data/venue-menu/venue-menu.source';
import { fromCocktailDb } from '../../products/data/cocktaildb.source';
import {
  requireRealVenueMenu,
  testVenueDrink,
} from '../../products/testing/venue-menu.testing';
import { APPLE_BANANA_DRINKS } from '../testing/apple-banana.fixture';
import {
  CabinetQuery,
  addIngredient,
  bestNextIngredient,
  buildIngredientIndex,
  hasTaste,
  matchCabinet,
  parseCabinetParams,
  removeIngredient,
  shelveIngredients,
  suggestIngredients,
} from './cabinet';

const METHOD = 'Shake with ice, strain into a chilled glass and garnish.';

let nextId = 1;
function recipe(
  name: string,
  ingredients: (string | [string, string])[],
  extra: Partial<Recipe> = {}
): Recipe {
  return {
    id: String(nextId++),
    source: 'cocktaildb',
    credit: 'TheCocktailDB',
    name,
    kind: 'cocktail',
    ingredients: ingredients.map(i =>
      Array.isArray(i)
        ? { name: i[0], measure: i[1] }
        : { name: i, measure: '1 oz' }
    ),
    instructions: METHOD,
    translations: [],
    hasDetails: true,
    ...extra,
  };
}

const ginTonic = recipe('Gin and Tonic', ['Gin', 'Tonic water', 'Lime', 'Ice']);
const margarita = recipe('Margarita', [
  'Tequila',
  'Triple sec',
  'Lime juice',
  'Salt',
]);
const daiquiri = recipe('Daiquiri', ['Light rum', 'Lime juice', 'Sugar syrup']);
const lemonWater = recipe('Lemon Water', ['Lemon', 'Water', 'Ice'], {
  kind: 'mocktail',
});
const virginMojito = recipe(
  'Virgin Mojito',
  ['Mint', 'Lime juice', 'Sugar', 'Soda water'],
  {
    kind: 'mocktail',
  }
);
const punch = recipe(
  'Fruit Punch',
  ['Orange juice', 'Lemon juice', 'Grenadine'],
  {
    kind: 'optional',
  }
);
const ALL = [ginTonic, margarita, daiquiri, lemonWater, virginMojito, punch];

function query(
  have: string[],
  extra: Partial<CabinetQuery> = {}
): CabinetQuery {
  return { have: have.map(ingredientKey), type: 'both', tastes: [], ...extra };
}

const names = (matches: { recipe: Recipe }[]) =>
  matches.map(m => m.recipe.name);

describe('cabinet matching', () => {
  it('makes a drink from a single ingredient when the rest are basics', () => {
    const { ready } = matchCabinet(ALL, query(['lemon']), rules);
    expect(names(ready)).toEqual(['Lemon Water']);
  });

  it('makes a drink when several ingredients cover the recipe', () => {
    const { ready, almost } = matchCabinet(
      ALL,
      query(['Gin', 'Tonic water', 'Lime']),
      rules
    );
    expect(names(ready)).toContain('Gin and Tonic');
    expect(names(almost)).not.toContain('Gin and Tonic');
  });

  it('puts a drink one ingredient short under "almost", naming what is missing', () => {
    const { ready, almost } = matchCabinet(
      ALL,
      query(['tequila', 'triple sec', 'lime juice']),
      rules
    );
    expect(names(ready)).not.toContain('Margarita');
    const match = almost.find(m => m.recipe.name === 'Margarita')!;
    expect(match.missing).toEqual([{ key: 'salt', name: 'Salt' }]);
  });

  it('keeps a drink missing two or more ingredients under "almost", listing every one', () => {
    const { ready, almost } = matchCabinet(ALL, query(['tequila']), rules);
    expect(names(ready)).not.toContain('Margarita');
    const match = almost.find(m => m.recipe.name === 'Margarita')!;
    expect(match.missing.map(m => m.name)).toEqual([
      'Triple sec',
      'Lime juice',
      'Salt',
    ]);
  });

  it('lists the closest drinks first', () => {
    const { almost } = matchCabinet(
      ALL,
      query(['tequila', 'triple sec', 'light rum']),
      rules
    );
    expect(almost.map(m => m.missing.length)).toEqual(
      [...almost.map(m => m.missing.length)].sort((a, b) => a - b)
    );
    expect(almost[0].recipe.name).toBe('Margarita');
  });

  it('returns nothing when no drink fits', () => {
    const result = matchCabinet(ALL, query(['absinthe']), rules);
    expect(result.ready).toEqual([]);
    expect(result.almost).toEqual([]);
  });

  it('returns nothing for an empty cabinet', () => {
    const result = matchCabinet(ALL, query([]), rules);
    expect(result).toEqual({ ready: [], almost: [], checked: 0 });
  });

  describe('drink type', () => {
    const have = [
      'lime juice',
      'mint',
      'sugar',
      'soda water',
      'light rum',
      'sugar syrup',
      'lemon',
    ];

    it('cocktails only leaves out mocktails', () => {
      const { ready } = matchCabinet(
        ALL,
        query(have, { type: 'cocktail' }),
        rules
      );
      expect(names(ready)).toEqual(['Daiquiri']);
    });

    it('mocktails only leaves out cocktails', () => {
      const { ready } = matchCabinet(
        ALL,
        query(have, { type: 'mocktail' }),
        rules
      );
      expect(names(ready)).toEqual(['Virgin Mojito', 'Lemon Water']);
    });

    it('both includes either, plus optional-alcohol drinks', () => {
      const { ready, almost } = matchCabinet(
        ALL,
        query([...have, 'orange juice']),
        rules
      );
      expect(names(ready)).toEqual(
        jasmine.arrayWithExactContents([
          'Daiquiri',
          'Lemon Water',
          'Virgin Mojito',
        ])
      );
      expect(names(almost)).toContain('Fruit Punch');
    });

    it('counts optional-alcohol drinks as mocktails too', () => {
      const result = matchCabinet(
        ALL,
        query(['orange juice', 'lemon juice', 'grenadine'], {
          type: 'mocktail',
        }),
        rules
      );
      expect(names(result.ready)).toEqual(['Fruit Punch']);
    });
  });

  describe('quality', () => {
    it('leaves out the low-quality drinks hidden on the Drinks page', () => {
      const shot = recipe('Straight Vodka', ['Vodka', 'Ice']);
      const trivial = recipe('Vodka Juice', ['Vodka', 'Orange juice'], {
        instructions: 'Mix together.',
      });
      const noMeasures = recipe('Vodka Mystery', [
        ['Vodka', ''],
        ['Orange juice', ''],
        ['Lime juice', ''],
      ]);
      noMeasures.ingredients.forEach(i => delete i.measure);
      const { ready, almost } = matchCabinet(
        [shot, trivial, noMeasures],
        query(['vodka', 'orange juice', 'lime juice']),
        rules
      );
      expect(ready).toEqual([]);
      expect(almost).toEqual([]);
    });

    it('shows a duplicated drink once', () => {
      const copy = recipe('Daiquiri', [
        'Light rum',
        'Lime juice',
        'Sugar syrup',
      ]);
      const { ready } = matchCabinet(
        [daiquiri, copy],
        query(['light rum', 'lime juice', 'sugar syrup']),
        rules
      );
      expect(ready.length).toBe(1);
    });
  });

  it('skips recipes with missing or unknown data without throwing', () => {
    const listOnly = recipe('List Entry', [], { hasDetails: false });
    const noIngredients = {
      ...recipe('Broken', ['Gin', 'Lime']),
      ingredients: undefined,
    } as unknown as Recipe;
    const blankNames = recipe('Blank Names', ['Gin', 'Tonic water']);
    blankNames.ingredients.push({ name: null } as unknown as { name: string }, {
      name: '  ',
    });
    const noKind = recipe('Mystery Gin', ['Gin', 'Tonic water'], {
      kind: undefined as DrinkKind | undefined,
    });

    let result!: ReturnType<typeof matchCabinet>;
    expect(() => {
      result = matchCabinet(
        [listOnly, noIngredients, blankNames, noKind],
        query(['gin', 'tonic water']),
        rules
      );
    }).not.toThrow();
    expect(names(result.ready)).toEqual(['Blank Names', 'Mystery Gin']);
  });

  describe('ingredient intelligence', () => {
    it('ignores case, accents, punctuation and "fresh"', () => {
      expect(ingredientKey('Fresh Lime Juice')).toBe('lime juice');
      expect(ingredientKey('Jägermeister')).toBe(ingredientKey('Jagermeister'));
      expect(ingredientKey('7-Up')).toBe(ingredientKey('7-up'));
      expect(ingredientKey('Whisky')).toBe('whiskey');
      expect(ingredientKey(undefined)).toBe('');
    });

    it('lets a whole lime cover lime juice, and says so', () => {
      const { ready } = matchCabinet(
        [daiquiri],
        query(['light rum', 'lime', 'sugar syrup']),
        rules
      );
      expect(names(ready)).toEqual(['Daiquiri']);
      expect(ready[0].stands).toEqual([{ have: 'lime', need: 'lime juice' }]);
    });

    it('does not let lime juice stand in for a whole lime', () => {
      const { ready } = matchCabinet(
        [ginTonic],
        query(['gin', 'tonic water', 'lime juice']),
        rules
      );
      expect(ready).toEqual([]);
    });

    it('accepts bottled juice when the recipe juices the fruit', () => {
      const sour = recipe('Whiskey Sour', [
        'Whiskey',
        ['Lemon', 'Juice of 1/2'],
        'Sugar',
      ]);
      const { ready } = matchCabinet(
        [sour],
        query(['whiskey', 'lemon juice', 'sugar']),
        rules
      );
      expect(names(ready)).toEqual(['Whiskey Sour']);
    });

    it('applies named-style rules in one direction only', () => {
      const withTripleSec = matchCabinet(
        [margarita],
        query(['tequila', 'cointreau', 'lime juice', 'salt']),
        rules
      );
      expect(names(withTripleSec.ready)).toEqual(['Margarita']);

      const cosmo = recipe('Cosmo', ['Vodka', 'Cointreau', 'Cranberry juice']);
      const withCointreau = matchCabinet(
        [cosmo],
        query(['vodka', 'triple sec', 'cranberry juice']),
        rules
      );
      expect(withCointreau.ready).toEqual([]);
      expect(withCointreau.almost[0].missing[0].key).toBe('cointreau');
    });

    it('treats soda water and club soda as the same thing', () => {
      const { ready } = matchCabinet(
        [virginMojito],
        query(['mint', 'lime juice', 'sugar', 'club soda']),
        rules
      );
      expect(names(ready)).toEqual(['Virgin Mojito']);
    });
  });

  describe('tastes', () => {
    const have = [
      'tequila',
      'triple sec',
      'lime juice',
      'salt',
      'gin',
      'tonic water',
      'lime',
    ];

    it('keeps only drinks with an ingredient that carries the taste', () => {
      const sour = matchCabinet(
        ALL,
        query(have, { tastes: ['sour'] }),
        rules,
        DEFAULT_TASTES
      );
      expect(names(sour.ready)).toEqual(
        jasmine.arrayWithExactContents(['Margarita', 'Gin and Tonic'])
      );
      const bitter = matchCabinet(
        ALL,
        query(have, { tastes: ['bitter'] }),
        rules,
        DEFAULT_TASTES
      );
      expect(names(bitter.ready)).toEqual(['Gin and Tonic']);
    });

    it('requires every picked taste', () => {
      const both = matchCabinet(
        ALL,
        query(have, { tastes: ['sour', 'bitter'] }),
        rules,
        DEFAULT_TASTES
      );
      expect(names(both.ready)).toEqual(['Gin and Tonic']);
      const none = matchCabinet(
        ALL,
        query(have, { tastes: ['spicy'] }),
        rules,
        DEFAULT_TASTES
      );
      expect(none.ready).toEqual([]);
    });
  });

  it('suggests the missing ingredient that finishes the most drinks', () => {
    const { almost } = matchCabinet(
      ALL,
      query(['light rum', 'sugar syrup', 'mint', 'sugar', 'soda water']),
      rules
    );
    expect(bestNextIngredient(almost)).toEqual({ key: 'lime juice', count: 2 });
    expect(bestNextIngredient([])).toBeUndefined();
  });
});

describe('cabinet ingredients', () => {
  it('adds an ingredient once', () => {
    let have = addIngredient([], 'Lime juice');
    have = addIngredient(have, 'lime juice');
    have = addIngredient(have, 'Fresh Lime Juice');
    expect(have).toEqual(['lime juice']);
    expect(addIngredient(have, '  ')).toBe(have);
  });

  it('removes one ingredient and keeps the rest', () => {
    expect(removeIngredient(['gin', 'lime', 'mint'], 'lime')).toEqual([
      'gin',
      'mint',
    ]);
    expect(removeIngredient(['gin'], 'vodka')).toEqual(['gin']);
  });

  describe('index and suggestions', () => {
    const lime = recipe('Gimlet', ['Gin', 'Lime Juice', 'Sugar syrup']);
    const index = buildIngredientIndex([...ALL, lime], rules);

    it('lists each ingredient once, in its most common spelling, without basics', () => {
      const limeJuice = index.find(o => o.key === 'lime juice')!;
      expect(limeJuice.label).toBe('Lime juice');
      expect(limeJuice.count).toBe(4);
      expect(index.some(o => o.key === 'ice' || o.key === 'water')).toBeFalse();
    });

    it('finds ingredients by any word, exact match first', () => {
      expect(suggestIngredients(index, 'LIME').map(o => o.key)).toEqual([
        'lime',
        'lime juice',
      ]);
      expect(suggestIngredients(index, 'juice').map(o => o.key)).toContain(
        'orange juice'
      );
      expect(suggestIngredients(index, 'limes').map(o => o.key)).toContain(
        'lime'
      );
    });

    it('leaves out what is already picked, and invents nothing', () => {
      expect(
        suggestIngredients(index, 'lime', ['lime']).map(o => o.key)
      ).toEqual(['lime juice']);
      expect(suggestIngredients(index, 'lychee')).toEqual([]);
      expect(suggestIngredients(index, '')).toEqual([]);
    });
  });

  describe('URL state', () => {
    const tastes = DEFAULT_TASTES.map(t => t.id);

    it('reads ingredients, type and tastes, dropping duplicates and junk', () => {
      const params = convertToParamMap({
        i: ['Gin', 'gin', 'lime juice', ''],
        type: 'mocktail',
        taste: 'sour,salty,sour',
      });
      expect(parseCabinetParams(params, tastes)).toEqual({
        have: ['gin', 'lime juice'],
        type: 'mocktail',
        tastes: ['sour'],
      });
    });

    it('defaults to both and nothing picked', () => {
      expect(
        parseCabinetParams(convertToParamMap({ type: 'shots' }), tastes)
      ).toEqual({
        have: [],
        type: 'both',
        tastes: [],
      });
    });
  });
});

describe('ingredient shelves', () => {
  const categories = defaultCategories(DEFAULT_SPIRITS.flatMap(s => s.terms));
  const option = (label: string) => ({
    key: ingredientKey(label),
    label,
    count: 1,
  });
  const shelfOf = (
    shelves: ReturnType<typeof shelveIngredients>,
    label: string
  ) => shelves.find(s => s.options.some(o => o.label === label))?.category.id;

  it('puts each ingredient on the shelf its name says, with word priority', () => {
    const labels = [
      'Gin',
      'Bourbon',
      'Absolut Citron',
      'Sloe gin',
      'Malibu rum',
      'Coffee liqueur',
      'Triple sec',
      'Sweet Vermouth',
      'Ruby Port',
      'Lime juice',
      'Peach nectar',
      'Lime',
      'Cherries',
      'Lemon peel',
      'Mint',
      'Orange bitters',
      'Celery salt',
      'Tabasco sauce',
      'Sugar syrup',
      'Grenadine',
      'Egg white',
      'Heavy cream',
      'Tonic water',
      'Ginger ale',
      'Root beer',
      'Dr. Pepper',
      'Sour mix',
      'Ginger',
      'Oreo cookie',
    ];
    const shelves = shelveIngredients(labels.map(option), categories);
    const placed = Object.fromEntries(
      labels.map(l => [l, shelfOf(shelves, l)])
    );
    expect(placed).toEqual({
      Gin: 'spirits',
      Bourbon: 'spirits',
      'Absolut Citron': 'spirits',
      'Sloe gin': 'liqueurs',
      'Malibu rum': 'liqueurs',
      'Coffee liqueur': 'liqueurs',
      'Triple sec': 'liqueurs',
      'Sweet Vermouth': 'wine',
      'Ruby Port': 'wine',
      'Lime juice': 'juices',
      'Peach nectar': 'juices',
      Lime: 'fruit',
      Cherries: 'fruit',
      'Lemon peel': 'garnishes',
      Mint: 'garnishes',
      'Orange bitters': 'spices',
      'Celery salt': 'spices',
      'Tabasco sauce': 'spices',
      'Sugar syrup': 'syrups',
      Grenadine: 'syrups',
      'Egg white': 'dairy',
      'Heavy cream': 'dairy',
      'Tonic water': 'mixers',
      'Ginger ale': 'mixers',
      'Root beer': 'mixers',
      'Dr. Pepper': 'mixers',
      'Sour mix': 'mixers',
      Ginger: 'spices',
      'Oreo cookie': 'other',
    });
  });

  it('shows only shelves with ingredients, in category order, sorted A–Z', () => {
    const shelves = shelveIngredients(
      ['Vodka', 'Gin', 'Lime juice', 'Marshmallows'].map(option),
      categories
    );
    expect(shelves.map(s => s.category.id)).toEqual([
      'spirits',
      'juices',
      'other',
    ]);
    expect(shelves[0].options.map(o => o.label)).toEqual(['Gin', 'Vodka']);
  });

  it('places every ingredient exactly once and handles an empty index', () => {
    const index = buildIngredientIndex(ALL, rules);
    const shelved = shelveIngredients(index, categories).flatMap(
      s => s.options
    );
    expect(shelved.length).toBe(index.length);
    expect(shelveIngredients([], categories)).toEqual([]);
  });
});

describe('venue-menu drinks in What Can I Make?', () => {
  // Fictional menu drinks: ingredients as a menu lists them, with its flavour notes.
  const MENU = [
    testVenueDrink(
      'Saffron Lassi',
      'mocktail',
      ['sweetened yoghurt', 'saffron syrup'],
      ['sweet', 'fruity']
    ),
    testVenueDrink(
      'Smoke & Clove',
      'cocktail',
      ['mezcal', 'clove cordial'],
      ['smoky']
    ),
    testVenueDrink(
      'Kelp Fizz',
      'zero_proof',
      ['non-alcoholic rum', 'kelp spice mix'],
      ['spicy']
    ),
    testVenueDrink(
      'Test Monsoon Cooler',
      'cocktail',
      ['gin', 'cucumber'],
      ['sour']
    ),
    testVenueDrink(
      'Cloudberry Smash',
      'cocktail',
      ['vodka', 'passionfruit', 'cloudberry'],
      ['fruity']
    ),
  ].map(fromVenueMenu);
  const menuDrink = (name: string) => MENU.find(r => r.name === name)!;
  const keys = (names: string[]) => names.map(ingredientKey);

  it('matches them like any other catalogue drink, with no separate section', () => {
    const result = matchCabinet(
      [...ALL, ...MENU],
      {
        have: keys(['Sweetened yoghurt', 'Saffron syrup', 'Lemon']),
        type: 'both',
        tastes: [],
      },
      rules
    );
    expect(names(result.ready)).toEqual(
      jasmine.arrayWithExactContents(['Lemon Water', 'Saffron Lassi'])
    );
    expect(Object.keys(result)).toEqual(['ready', 'almost', 'checked']);
  });

  it('counts them among the drinks checked', () => {
    const withMenu = matchCabinet([...ALL, ...MENU], query(['gin']), rules);
    const without = matchCabinet(ALL, query(['gin']), rules);
    expect(withMenu.checked).toBe(without.checked + MENU.length);
  });

  it('puts a venue drink that needs more under "almost", naming what is missing', () => {
    const result = matchCabinet(
      MENU,
      { have: keys(['Mezcal', 'Sweetened yoghurt']), type: 'both', tastes: [] },
      rules
    );
    const smoke = result.almost.find(m => m.recipe.name === 'Smoke & Clove')!;
    expect(smoke.missing.map(m => m.name)).toEqual(['clove cordial']);
    expect(result.almost.map(m => m.missing.length)).toEqual(
      [...result.almost.map(m => m.missing.length)].sort((a, b) => a - b)
    );
  });

  it('respects drink type: zero-proof drinks are mocktails', () => {
    const have = keys(['Non-alcoholic rum', 'Kelp spice mix']);
    const asMocktail = matchCabinet(
      MENU,
      { have, type: 'mocktail', tastes: [] },
      rules
    );
    const asCocktail = matchCabinet(
      MENU,
      { have, type: 'cocktail', tastes: [] },
      rules
    );
    expect(names(asMocktail.ready)).toEqual(['Kelp Fizz']);
    expect(names([...asCocktail.ready, ...asCocktail.almost])).not.toContain(
      'Kelp Fizz'
    );
  });

  it('uses the menu’s own flavour notes for tastes', () => {
    const lassi = menuDrink('Saffron Lassi'); // "sweet, fruity"
    const sweet = DEFAULT_TASTES.find(t => t.id === 'sweet')!;
    const sour = DEFAULT_TASTES.find(t => t.id === 'sour')!;
    expect(hasTaste(lassi, sweet)).toBeTrue();
    expect(hasTaste(lassi, sour)).toBeFalse();
    // Test Monsoon Cooler lists no citrus, but its menu notes call it sour.
    expect(hasTaste(menuDrink('Test Monsoon Cooler'), sour)).toBeTrue();
  });

  it('offers their ingredients in the picker', () => {
    const index = buildIngredientIndex([...ALL, ...MENU], rules);
    const cloudberry = index.find(o => o.key === 'cloudberry');
    expect(cloudberry?.label).toBe('Cloudberry');
    expect(index.some(o => o.key === 'passion fruit')).toBeTrue();
    expect(index.some(o => o.key === 'passionfruit')).toBeFalse();
  });
});

describe('ingredient aliases for the venue menu', () => {
  /** True when having `have` covers a single-ingredient need in a complete recipe. */
  function covers(have: string, need: string): boolean {
    const target = recipe(`Needs ${need}`, [
      need,
      'Lemon juice',
      'Sugar syrup',
    ]);
    const result = matchCabinet(
      [target],
      query([have, 'lemon juice', 'sugar syrup']),
      rules
    );
    return result.ready.length === 1;
  }

  it('treats tonic, Tabasco and mint leaves as the same thing both ways', () => {
    for (const [a, b] of [
      ['Tonic water', 'Tonic'],
      ['Tabasco sauce', 'Tabasco'],
      ['Mint', 'Mint leaves'],
    ]) {
      expect(covers(a, b)).withContext(`${a} -> ${b}`).toBeTrue();
      expect(covers(b, a)).withContext(`${b} -> ${a}`).toBeTrue();
    }
  });

  it('reads passionfruit and passion fruit as one spelling, apart from its juice and syrup', () => {
    expect(ingredientKey('passionfruit')).toBe('passion fruit');
    expect(covers('Passionfruit', 'Passion fruit')).toBeTrue();
    expect(covers('Passion fruit', 'Passion fruit juice')).toBeFalse();
    expect(covers('Passion fruit', 'Passion fruit syrup')).toBeFalse();
  });

  it('lets soda water, club soda and carbonated water cover the menu’s "soda", one way', () => {
    for (const water of ['Soda water', 'Club soda', 'Carbonated water'])
      expect(covers(water, 'Soda')).toBeTrue();
    expect(covers('Soda', 'Soda water')).toBeFalse();
  });

  it('lets a cola brand cover "cola", but not the reverse', () => {
    expect(covers('Coca-Cola', 'Cola')).toBeTrue();
    expect(covers('Pepsi Cola', 'Cola')).toBeTrue();
    expect(covers('Cola', 'Coca-Cola')).toBeFalse();
  });

  it('keeps pink guava juice and guava juice distinct, one way only', () => {
    expect(covers('Pink guava juice', 'Guava juice')).toBeTrue();
    expect(covers('Guava juice', 'Pink guava juice')).toBeFalse();
  });

  it('keeps lime juice from standing in for a whole lime', () => {
    expect(covers('Lime', 'Lime juice')).toBeTrue();
    expect(covers('Lime juice', 'Lime')).toBeFalse();
  });

  it('maps the menu’s branded spirits one way, and never alcohol-free spirits', () => {
    expect(covers('Camino Blanco', 'Tequila')).toBeTrue();
    expect(covers('Tequila', 'Camino Blanco')).toBeFalse();
    expect(covers("Dewar's White Label", 'Whiskey')).toBeTrue();
    expect(covers('Bacardi Carta Blanca', 'White rum')).toBeTrue();
    expect(covers('Bacardi Black', 'Dark rum')).toBeTrue();
    expect(covers('Sober gin', 'Gin')).toBeFalse();
    expect(covers('Sober rum', 'Rum')).toBeFalse();
    expect(covers('Gin', 'Sober gin')).toBeFalse();
  });

  it('treats "fresh" as the same ingredient, as before', () => {
    expect(covers('Watermelon', 'Fresh watermelon')).toBeTrue();
  });
});

// The real menu's ingredients: skipped, and reported as such, where it's absent.
describe('shelves for venue-menu ingredients', () => {
  requireRealVenueMenu();
  const categories = defaultCategories(DEFAULT_SPIRITS.flatMap(s => s.terms));
  const index = buildIngredientIndex(
    VENUE_MENU_DRINKS.map(fromVenueMenu),
    rules
  );
  const shelves = shelveIngredients(index, categories);
  const shelfOf = (label: string) =>
    shelves.find(s => s.options.some(o => o.label === label))?.category.id;

  it('puts alcohol-free spirits on their own shelf, never with spirits', () => {
    for (const label of ['Sober gin', 'Sober pink gin', 'Sober rum'])
      expect(shelfOf(label)).withContext(label).toBe('alcohol-free');
    const spirits = shelves
      .find(s => s.category.id === 'spirits')!
      .options.map(o => o.label);
    expect(spirits.some(l => /sober/i.test(l))).toBeFalse();
  });

  it('shelves the menu’s ingredients where a bartender would look', () => {
    const expected: Record<string, string> = {
      'Camino Blanco': 'spirits',
      "Dewar's White Label": 'spirits',
      'Bacardi Black': 'spirits',
      'Coconut Campari': 'liqueurs',
      'House spice mix': 'spices',
      'Jamun spice mix': 'spices',
      'Makrut lime leaf': 'garnishes',
      'Curry leaf': 'garnishes',
      Kokum: 'fruit',
      Lychee: 'fruit',
      Cola: 'mixers',
      Soda: 'mixers',
      'House-made kokum cordial': 'syrups',
      'Sweetened yoghurt': 'dairy',
      Jalapeños: 'spices',
    };
    for (const [label, id] of Object.entries(expected))
      expect(shelfOf(label)).withContext(label).toBe(id);
  });

  it('leaves only the genuinely unclear ones under Everything else', () => {
    const other = shelves.find(s => s.category.id === 'other');
    expect(other?.options.map(o => o.label) ?? []).toEqual([
      'Cacao butter',
      'Pandan rosoo',
    ]);
  });
});

describe('apple and banana, against real TheCocktailDB records', () => {
  const CATALOGUE = APPLE_BANANA_DRINKS.map(fromCocktailDb);
  const find = (have: string[], extra: Partial<CabinetQuery> = {}) =>
    matchCabinet(CATALOGUE, query(have, extra), rules, DEFAULT_TASTES);
  const all = (r: ReturnType<typeof find>) => [...r.ready, ...r.almost];
  const missingOf = (r: ReturnType<typeof find>, name: string) =>
    all(r)
      .find(m => m.recipe.name === name)
      ?.missing.map(m => m.name);

  it('1: Apple finds the apple drinks, including ones that need more', () => {
    const result = find(['Apple']);
    expect(names(all(result))).toEqual(
      jasmine.arrayWithExactContents([
        'Apple Berry Smoothie',
        'Fruit Cooler',
        'Sweet Sangria',
        'White Wine Sangria',
      ])
    );
  });

  it('2: Apple and Banana find drinks using either, including the smoothies and shakes', () => {
    const found = names(all(find(['Apple', 'Banana'])));
    for (const name of [
      'Apple Berry Smoothie',
      'Banana Cantaloupe Smoothie',
      'Banana Milk Shake',
      'Banana Strawberry Shake',
      'Banana Strawberry Shake Daiquiri',
      'Fruit Shake',
      'Sweet Bananas',
    ])
      expect(found).toContain(name);
    expect(new Set(found).size).toBe(found.length);
  });

  it('3: names exactly what is missing, and never counts a similar ingredient', () => {
    const result = find(['Apple']);
    expect(missingOf(result, 'Apple Berry Smoothie')).toEqual(['Berries']);
    expect(names(result.almost)).toContain('Apple Berry Smoothie');
    // Apple juice is not the same as an apple.
    const both = find(['Apple', 'Banana']);
    expect(missingOf(both, 'Banana Strawberry Shake Daiquiri')).toEqual([
      'Strawberries',
      'Apple juice',
    ]);
  });

  it('4: Mocktails keeps the non-alcoholic matches', () => {
    const found = names(all(find(['Apple', 'Banana'], { type: 'mocktail' })));
    expect(found).toContain('Apple Berry Smoothie');
    expect(found).toContain('Banana Milk Shake');
    expect(found).not.toContain('Sweet Sangria');
    expect(found).not.toContain('White Wine Sangria');
  });

  it('5: a taste narrows the matches without breaking them', () => {
    const found = names(all(find(['Apple', 'Banana'], { tastes: ['sweet'] })));
    expect(found).toContain('Banana Milk Shake');
    expect(found).toContain('Sweet Bananas');
    expect(found).not.toContain('Apple Berry Smoothie');
  });

  it('6: an ingredient no recipe uses matches nothing, honestly', () => {
    const result = find(['Mogu Mogu']);
    expect(result.ready).toEqual([]);
    expect(result.almost).toEqual([]);
  });
});
