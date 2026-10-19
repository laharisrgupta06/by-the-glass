import {
  MyRecipeDraft,
  draftProblems,
  formatMeasure,
  isSaveable,
  newRecipeId,
  quantityProblem,
  readMyRecipe,
  stepsFromText,
  toDisplayRecipe,
} from './my-recipe.model';

const DRAFT: MyRecipeDraft = {
  name: 'Garden Spritz',
  description: 'Bright and herbal, with cucumber and elderflower.',
  kind: 'cocktail',
  ingredients: [
    { name: 'Gin', quantity: '45', unit: 'ml' },
    { name: 'Elderflower cordial', quantity: '1/2', unit: 'oz' },
    { name: 'Soda water', quantity: '', unit: 'top up' },
  ],
  steps: ['Build over ice.', 'Top with soda.'],
  glass: 'Highball',
  ice: '',
  garnish: 'Cucumber ribbon',
};

describe('My recipes: drafts', () => {
  it('accepts a complete recipe, with optional fields left empty', () => {
    expect(draftProblems(DRAFT)).toEqual({});
    expect(isSaveable(DRAFT)).toBeTrue();
  });

  it('names every missing required field', () => {
    const problems = draftProblems({
      ...DRAFT,
      name: ' ',
      description: '',
      ingredients: [],
      steps: [],
    });
    expect(problems.name).toBe('Add a name.');
    expect(problems.description).toBe('Add a short description.');
    expect(problems.ingredients).toBe('Add at least one ingredient.');
    expect(problems.steps).toBe('Add the method: one step per line.');
  });

  it('checks each ingredient’s name, amount and unit', () => {
    const problems = draftProblems({
      ...DRAFT,
      ingredients: [
        { name: '', quantity: '45', unit: 'ml' },
        { name: 'Lime juice', quantity: '', unit: 'ml' },
        { name: 'Sugar', quantity: 'a little', unit: 'tsp' },
        { name: 'Salt', quantity: '1', unit: 'to taste' },
        { name: 'Bitters', quantity: '0', unit: 'dash' },
      ],
    });
    expect(problems.ingredient![0].name).toBe('Name the ingredient.');
    expect(problems.ingredient![1].quantity).toBe(
      'Add an amount, e.g. 45 or 1 1/2.'
    );
    expect(problems.ingredient![2].quantity).toContain(
      'Use a number, fraction or range'
    );
    expect(problems.ingredient![3].quantity).toBe(
      'Leave the amount empty for “to taste”.'
    );
    expect(problems.ingredient![4].quantity).toBe('The amount can’t be zero.');
    for (const ok of ['45', '1.5', '1/2', '1 1/2', '2-3'])
      expect(quantityProblem(ok, 'ml')).withContext(ok).toBeNull();
  });

  it('keeps prices out of every field', () => {
    expect(
      draftProblems({ ...DRAFT, description: 'Costs ₹300' }).description
    ).toBe('Leave prices out: By the Glass shows none.');
    expect(draftProblems({ ...DRAFT, steps: ['Charge $5.'] }).steps).toContain(
      'prices'
    );
  });

  it('reads the method one step per line, dropping typed numbering', () => {
    expect(stepsFromText('1. Shake hard\n\n2) Strain\n- Garnish ')).toEqual([
      'Shake hard',
      'Strain',
      'Garnish',
    ]);
  });

  it('writes measures the way the recipe pages show them', () => {
    expect(formatMeasure({ name: 'x', quantity: '2', unit: 'dash' })).toBe(
      '2 dashes'
    );
    expect(formatMeasure({ name: 'x', quantity: '1', unit: 'dash' })).toBe(
      '1 dash'
    );
    expect(formatMeasure({ name: 'x', quantity: '1 1/2', unit: 'oz' })).toBe(
      '1 1/2 oz'
    );
    expect(formatMeasure({ name: 'x', quantity: '', unit: 'top up' })).toBe(
      'Top up'
    );
  });

  it('shows as an ordinary recipe of your own, with nothing invented', () => {
    const recipe = toDisplayRecipe({ ...DRAFT, id: 'abc' });
    expect(recipe.source).toBe('own');
    expect(recipe.ingredients).toEqual([
      { name: 'Gin', measure: '45 ml' },
      { name: 'Elderflower cordial', measure: '1/2 oz' },
      { name: 'Soda water', measure: 'Top up' },
    ]);
    expect(recipe.steps).toEqual(DRAFT.steps);
    expect(recipe.ice).toBeUndefined();
    expect(recipe.image).toBeUndefined();
    expect(recipe.tastes).toBeUndefined();
  });

  it('skips stored documents that aren’t a valid recipe', () => {
    expect(readMyRecipe('a', { ...DRAFT })?.name).toBe('Garden Spritz');
    expect(readMyRecipe('a', { ...DRAFT, kind: 'shot' })).toBeNull();
    expect(readMyRecipe('a', { ...DRAFT, ingredients: 'gin' })).toBeNull();
  });

  it('reads a stored photo, and ignores one that isn’t well formed', () => {
    const image = {
      path: 'users/u/myRecipes/a/photo-1.webp',
      url: 'https://storage.test/p.webp',
    };
    expect(readMyRecipe('a', { ...DRAFT, image })?.image).toEqual(image);
    expect(readMyRecipe('a', { ...DRAFT })?.image).toBeNull();
    expect(
      readMyRecipe('a', { ...DRAFT, image: { url: 'x' } })?.image
    ).toBeNull();
    const shown = toDisplayRecipe({ ...DRAFT, id: 'a', image });
    expect(shown.image).toBe(image.url);
    expect(shown.thumbnail).toBe(image.url);
  });

  it('makes ids Firestore’s rules accept', () => {
    const ids = new Set(Array.from({ length: 50 }, newRecipeId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9]{20}$/);
  });
});
