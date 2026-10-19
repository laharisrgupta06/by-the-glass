import {
  AiRecipe,
  aiRecipeId,
  checkBartenderAnswer,
  isAlcoholic,
  mentionsPrice,
  sanitizeAiRecipe,
} from './ai-recipe';

// A fictional menu drink's listed ingredients.
const NIGHT_FERRY = [
  'Fernhollow dark rum',
  'Cold brew',
  'Vanilla syrup',
  'Oat cream',
];

/** A plausible model answer for the fictional Test Night Ferry. */
function nightFerry(extra: Record<string, unknown> = {}) {
  return {
    name: 'Test Night Ferry',
    kind: 'cocktail',
    description: 'A rich, dark rum and cold brew nightcap with vanilla.',
    ingredients: [
      { name: 'fernhollow dark rum', amount: '45 ml', optional: false },
      { name: 'Cold brew', amount: '30 ml', optional: false },
      { name: 'Vanilla Syrup', amount: '15 ml', optional: false },
      { name: 'Oat cream', amount: '1 bar spoon', optional: false },
      { name: 'Sugar syrup', amount: '5 ml', optional: true },
    ],
    steps: [
      'Stir the oat cream into the vanilla syrup.',
      'Shake everything hard with ice.',
      'Double strain into a chilled coupe.',
    ],
    glass: 'Coupe',
    ice: 'Shake with ice; serve without.',
    garnish: 'Grated nutmeg',
    serving: 'Serve straight away.',
    ...extra,
  };
}

const menuOptions = {
  given: NIGHT_FERRY,
  requireAllGiven: true,
  kind: 'cocktail' as const,
  alcoholCheck: 'extras' as const,
};

describe('sanitizeAiRecipe', () => {
  it('keeps every menu ingredient in its exact spelling and marks additions', () => {
    const result = sanitizeAiRecipe(nightFerry(), menuOptions);
    expect(result.ok).toBeTrue();
    const recipe = (result as { recipe: AiRecipe }).recipe;
    expect(recipe.ingredients.map(i => [i.name, i.origin, i.optional])).toEqual(
      [
        ['Fernhollow dark rum', 'given', false],
        ['Cold brew', 'given', false],
        ['Vanilla syrup', 'given', false],
        ['Oat cream', 'given', false],
        ['Sugar syrup', 'extra', true],
      ]
    );
  });

  it('rejects a recipe that drops or replaces a listed ingredient', () => {
    const answer = nightFerry();
    answer.ingredients = answer.ingredients.filter(i => i.name !== 'Cold brew');
    answer.ingredients.push({
      name: 'Espresso',
      amount: '30 ml',
      optional: false,
    });
    expect(sanitizeAiRecipe(answer, menuOptions)).toEqual({
      ok: false,
      reason: 'dropped-a-given-ingredient',
    });
  });

  it('rejects malformed answers instead of repairing them', () => {
    expect(sanitizeAiRecipe(null, menuOptions).ok).toBeFalse();
    expect(sanitizeAiRecipe('text', menuOptions).ok).toBeFalse();
    expect(
      sanitizeAiRecipe(nightFerry({ steps: [] }), menuOptions).ok
    ).toBeFalse();
    expect(
      sanitizeAiRecipe(nightFerry({ glass: '' }), menuOptions).ok
    ).toBeFalse();
    expect(
      sanitizeAiRecipe(nightFerry({ kind: 'shot' }), menuOptions).ok
    ).toBeFalse();
    const noAmount = nightFerry();
    noAmount.ingredients[0].amount = 'some';
    expect(sanitizeAiRecipe(noAmount, menuOptions)).toEqual({
      ok: false,
      reason: 'bad-amount',
    });
  });

  it('rejects "No ice" when the method uses ice', () => {
    const contradiction = nightFerry({ ice: 'No ice' });
    expect(sanitizeAiRecipe(contradiction, menuOptions)).toEqual({
      ok: false,
      reason: 'ice-contradicts-method',
    });
    expect(
      sanitizeAiRecipe(
        nightFerry({ ice: 'Shaken with ice; served without' }),
        menuOptions
      ).ok
    ).toBeTrue();
    // Ice cream isn't ice.
    expect(
      sanitizeAiRecipe(
        nightFerry({ ice: 'No ice', steps: ['Blend with vanilla ice cream.'] }),
        menuOptions
      ).ok
    ).toBeTrue();
    // A recipe someone already saved is never hidden by this later check.
    expect(
      sanitizeAiRecipe(contradiction, { ...menuOptions, strictIce: false }).ok
    ).toBeTrue();
  });

  it('rejects the wrong kind of drink', () => {
    expect(
      sanitizeAiRecipe(nightFerry({ kind: 'mocktail' }), menuOptions).ok
    ).toBeFalse();
  });

  it('never lets a price through', () => {
    for (const text of [
      '₹450',
      '$12',
      'Rs. 300',
      'Price on request',
      'costs 10 EUR',
    ])
      expect(
        sanitizeAiRecipe(nightFerry({ serving: text }), menuOptions)
      ).toEqual({ ok: false, reason: 'mentions-a-price' });
    expect(mentionsPrice('Test Fizz 2.0, 45 ml')).toBeFalse();
  });

  it('keeps alcohol out of mocktails, except alcohol-free versions', () => {
    const mocktail = {
      ...nightFerry({ name: 'Mogu Fizz', kind: 'mocktail' }),
      ingredients: [
        { name: 'Mogu Mogu', amount: '200 ml', optional: false },
        { name: 'White rum', amount: '30 ml', optional: true },
      ],
    };
    const options = {
      given: ['Mogu Mogu'],
      requireAllGiven: false,
      kind: 'mocktail' as const,
      alcoholCheck: 'all' as const,
    };
    expect(sanitizeAiRecipe(mocktail, options)).toEqual({
      ok: false,
      reason: 'alcohol-in-mocktail',
    });
    expect(isAlcoholic('Sober gin')).toBeFalse();
    expect(isAlcoholic('Ginger beer')).toBeFalse();
    expect(isAlcoholic('Ginger ale')).toBeFalse();
    expect(isAlcoholic('Gin')).toBeTrue();
    expect(isAlcoholic('Bacardi Black')).toBeTrue();
  });
});

describe('the AI Bartender answer', () => {
  const request = {
    ingredients: ['Mogu Mogu', 'Lime'],
    type: 'mocktail' as const,
    tastes: [],
  };
  const answer = {
    name: 'Coconut Jelly Cooler',
    kind: 'mocktail',
    description: 'Mogu Mogu over ice with lime and soda.',
    ingredients: [
      { name: 'mogu mogu', amount: '1 bottle (320 ml)', optional: false },
      { name: 'Lime', amount: '1/2, juiced', optional: false },
      { name: 'Soda water', amount: 'Top up', optional: false },
      { name: 'Mint', amount: '1 sprig', optional: true },
    ],
    steps: [
      'Fill a highball with ice.',
      'Add lime and Mogu Mogu.',
      'Top with soda.',
    ],
    glass: 'Highball',
    ice: 'Over cubed ice',
    garnish: 'Mint sprig',
    serving: 'Serve with a wide straw for the jelly.',
  };

  it('keeps Mogu Mogu as Mogu Mogu, and marks what the person lacks', () => {
    const recipe = checkBartenderAnswer({ recipe: answer }, request)!;
    expect(recipe.ingredients.map(i => [i.name, i.origin, i.optional])).toEqual(
      [
        ['Mogu Mogu', 'given', false],
        ['Lime', 'given', false],
        ['Soda water', 'extra', false],
        ['Mint', 'extra', true],
      ]
    );
  });

  it('refuses a recipe that ignores every ingredient the person has', () => {
    const ignored = {
      ...answer,
      ingredients: [{ name: 'Fruit juice', amount: '200 ml', optional: false }],
    };
    expect(checkBartenderAnswer({ recipe: ignored }, request)).toBeNull();
  });

  it('gives the same recipe the same id, and a different one another', () => {
    const recipe = checkBartenderAnswer({ recipe: answer }, request)!;
    const again = checkBartenderAnswer({ recipe: answer }, request)!;
    expect(aiRecipeId(recipe)).toMatch(/^ai-[0-9a-f]{16}$/);
    expect(aiRecipeId(again)).toBe(aiRecipeId(recipe));
    expect(aiRecipeId({ ...recipe, name: 'Other' })).not.toBe(
      aiRecipeId(recipe)
    );
  });
});
