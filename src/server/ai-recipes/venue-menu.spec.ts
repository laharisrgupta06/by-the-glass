import {
  MenuIllustration,
  StoredMenuRecipe,
} from '../../app/core/ai/ai-recipe';
import { VenueMenuDrink } from '../../app/featured/products/data/venue-menu/venue-menu.data';
import {
  testVenueDrink,
  useVenueMenu,
} from '../../app/featured/products/testing/venue-menu.testing';
import type { GenerateImage } from '../ingredient-interpreter/gemini';
import { Generate } from '../ingredient-interpreter/handler';
import { RateLimiter } from '../ingredient-interpreter/rate-limiter';
import {
  IllustrationMeta,
  MenuDeps,
  MenuStorage,
  checkStoredRecipe,
  findDrink,
  handleCreateIllustration,
  handleCreateMenuRecipe,
  handleMenuExtras,
  illustrationPrompt,
} from './venue-menu';

/** In memory, with the disk store's rule: nothing is ever replaced. */
class FakeStorage implements MenuStorage {
  recipes = new Map<string, StoredMenuRecipe>();
  images = new Map<string, { data: Uint8Array; meta: IllustrationMeta }>();
  async readRecipe(drink: VenueMenuDrink) {
    const stored = this.recipes.get(drink.id);
    return stored ? checkStoredRecipe(drink, stored) : null;
  }
  async writeRecipe(drink: VenueMenuDrink, data: StoredMenuRecipe) {
    if (this.recipes.has(drink.id)) return false;
    this.recipes.set(drink.id, data);
    return true;
  }
  async readIllustration(
    drink: VenueMenuDrink
  ): Promise<MenuIllustration | null> {
    const image = this.images.get(drink.id);
    return image
      ? {
          url: `/api/venue-menu/${drink.id}/illustration`,
          model: image.meta.model,
          createdAt: image.meta.createdAt,
        }
      : null;
  }
  async writeIllustration(
    drink: VenueMenuDrink,
    data: Uint8Array,
    meta: IllustrationMeta
  ) {
    if (this.images.has(drink.id)) return false;
    this.images.set(drink.id, { data, meta });
    return true;
  }
}

// Fictional menu drinks, swapped in for the menu data in each test below.
const NIGHT_FERRY = testVenueDrink(
  'Test Night Ferry',
  'cocktail',
  ['Fernhollow Dark', 'cold brew', 'vanilla syrup', 'oat cream'],
  ['smoky', 'earthy']
);
const PINK_CLOUD = testVenueDrink(
  'Test Pink Cloud Tonic',
  'zero_proof',
  ['non-alcoholic gin', 'grapefruit', 'tonic'],
  ['bitter']
);
const TEST_MENU = [NIGHT_FERRY, PINK_CLOUD];
const DRINK = NIGHT_FERRY.id;
const LOCAL = { id: '127.0.0.1', local: true };
const REMOTE = {
  id: '1.2.3.4',
  origin: 'https://x.test',
  host: 'x.test',
  local: false,
};

const recipeFor = (drinkId: string, extra: Record<string, unknown> = {}) => {
  const drink = findDrink(drinkId)!;
  return {
    name: 'Something else',
    kind: drink.kind === 'cocktail' ? 'cocktail' : 'mocktail',
    description: 'A plausible take on the menu drink.',
    ingredients: drink.ingredients.map((name, i) => ({
      name,
      amount: `${(i + 1) * 10} ml`,
      optional: false,
    })),
    steps: ['Combine everything.', 'Shake with ice.', 'Strain.'],
    glass: 'Coupe',
    ice: 'Shake with ice; serve without.',
    garnish: '',
    serving: 'Serve at once.',
    ...extra,
  };
};

const answer = (value: unknown): Generate =>
  jasmine.createSpy('generate').and.resolveTo(JSON.stringify(value));

function deps(
  extra: Partial<MenuDeps> = {}
): MenuDeps & { store: FakeStorage } {
  return {
    store: new FakeStorage(),
    illustrationsEnabled: false,
    recipeLimiter: new RateLimiter(100, 60_000),
    imageLimiter: new RateLimiter(100, 60_000),
    ...extra,
  } as MenuDeps & { store: FakeStorage };
}

describe('venue-menu AI recipes', () => {
  useVenueMenu(TEST_MENU);

  it('only knows venue-menu drinks: catalogue drinks never get one', async () => {
    const d = deps({ generate: answer({}) });
    expect((await handleMenuExtras('11007', d)).status).toBe(404);
    expect((await handleCreateMenuRecipe('11007', LOCAL, d)).status).toBe(404);
    expect(d.generate).not.toHaveBeenCalled();
  });

  it('starts with nothing stored for a menu drink', async () => {
    const result = await handleMenuExtras(
      DRINK,
      deps({ generate: answer({}) })
    );
    expect(result.body).toEqual({
      recipe: null,
      illustration: null,
      canCreateRecipe: true,
    });
  });

  it('creates the recipe once, keeps every listed ingredient and the menu name, then reuses it', async () => {
    const generate = answer(recipeFor(DRINK));
    const d = deps({ generate });
    const first = await handleCreateMenuRecipe(DRINK, LOCAL, d);
    expect(first.status).toBe(201);
    const stored = first.body as StoredMenuRecipe;
    expect(stored.recipe.name).toBe('Test Night Ferry');
    expect(stored.menuIngredients).toEqual([
      'Fernhollow Dark',
      'cold brew',
      'vanilla syrup',
      'oat cream',
    ]);
    expect(stored.recipe.ingredients.map(i => [i.name, i.origin])).toEqual(
      stored.menuIngredients.map(name => [name, 'given'])
    );
    const prompt = (generate as jasmine.Spy).calls.mostRecent().args[0]
      .prompt as string;
    expect(prompt).toContain(
      'INGREDIENTS: ["Fernhollow Dark","cold brew","vanilla syrup","oat cream"]'
    );

    const again = await handleCreateMenuRecipe(DRINK, LOCAL, d);
    expect(again.status).toBe(200);
    expect(again.body).toEqual(stored);
    expect(generate).toHaveBeenCalledTimes(1);
    expect((await handleMenuExtras(DRINK, d)).body).toEqual(
      jasmine.objectContaining({ recipe: stored })
    );
  });

  it('stores nothing when the answer drops a listed ingredient', async () => {
    const answerWithout = recipeFor(DRINK);
    answerWithout.ingredients = answerWithout.ingredients.slice(1);
    const d = deps({ generate: answer(answerWithout) });
    expect((await handleCreateMenuRecipe(DRINK, LOCAL, d)).status).toBe(502);
    expect(d.store.recipes.size).toBe(0);
  });

  it('keeps alcohol out of a zero-proof drink, while allowing its own alcohol-free spirit', async () => {
    const id = PINK_CLOUD.id;
    const zeroProof = recipeFor(id);
    const ok = await handleCreateMenuRecipe(
      id,
      LOCAL,
      deps({ generate: answer(zeroProof) })
    );
    expect(ok.status).toBe(201);
    const spiked = recipeFor(id, {
      ingredients: [
        ...zeroProof.ingredients,
        { name: 'Gin', amount: '15 ml', optional: true },
      ],
    });
    const rejected = await handleCreateMenuRecipe(
      id,
      LOCAL,
      deps({ generate: answer(spiked) })
    );
    expect(rejected.status).toBe(502);
  });
});

describe('venue-menu illustrations', () => {
  useVenueMenu(TEST_MENU);

  const png = new Uint8Array(2000);
  const image = (mimeType = 'image/png'): GenerateImage =>
    jasmine
      .createSpy('image')
      .and.resolveTo({ data: png, mimeType, model: 'gemini-2.5-flash-image' });

  it('are switched off unless turned on, and then only from this machine', async () => {
    const generateImage = image();
    expect(
      (await handleCreateIllustration(DRINK, LOCAL, deps({ generateImage })))
        .body
    ).toEqual({ error: 'disabled' });
    const on = deps({ generateImage, illustrationsEnabled: true });
    expect((await handleCreateIllustration(DRINK, REMOTE, on)).status).toBe(
      403
    );
    expect(generateImage).not.toHaveBeenCalled();
  });

  it('are made once and labelled, then reused', async () => {
    const generateImage = image();
    const d = deps({ generateImage, illustrationsEnabled: true });
    expect((await handleCreateIllustration(DRINK, LOCAL, d)).status).toBe(201);
    expect(d.store.images.get(DRINK)!.meta.label).toBe(
      'AI-generated illustration'
    );
    expect((await handleCreateIllustration(DRINK, LOCAL, d)).status).toBe(200);
    expect(generateImage).toHaveBeenCalledTimes(1);
    expect((await handleCreateIllustration('11007', LOCAL, d)).status).toBe(
      404
    );
  });

  it('refuse something that is not an image', async () => {
    const d = deps({
      generateImage: image('text/html'),
      illustrationsEnabled: true,
    });
    expect((await handleCreateIllustration(DRINK, LOCAL, d)).status).toBe(502);
    expect(d.store.images.size).toBe(0);
  });

  it('ask for an illustration, not a photo, with no text or prices', () => {
    const prompt = illustrationPrompt(findDrink(DRINK)!, 'Coupe');
    expect(prompt).toContain('clearly not a photograph');
    expect(prompt).toContain(
      'Fernhollow Dark, cold brew, vanilla syrup, oat cream'
    );
    expect(prompt).toContain('No text');
    expect(prompt).toContain('prices');
    expect(prompt).toContain('served in a coupe');
  });
});
