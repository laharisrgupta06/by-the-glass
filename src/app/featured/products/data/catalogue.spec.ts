import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { API_URL, ApiURL } from '../config/product.config';
import { Recipe } from '../models/recipe.model';
import {
  LETTER_RETRY_MS,
  ProductService,
  clearCatalogueCache,
} from '../services/product.service';
import { Catalogue, preferDetailed } from './catalogue';
import { CocktailDbSource } from './cocktaildb.source';
import { CuratedSource } from './curated.source';
import { DrinkRepository } from './drink.repository';
import { VENUE_MENU_DRINKS } from './venue-menu/venue-menu.data';
import { VENUE_MENU_ENABLED } from './venue-menu/venue-menu.source';
import {
  answerLetters,
  answerLists,
  detailed,
  fillers,
  listed,
} from '../testing/catalogue-http';
import {
  requireRealVenueMenu,
  testVenueDrink,
  useVenueMenu,
} from '../testing/venue-menu.testing';

function setUp(menuEnabled = false) {
  clearCatalogueCache();
  TestBed.configureTestingModule({
    providers: [
      DrinkRepository,
      CuratedSource,
      CocktailDbSource,
      ProductService,
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: API_URL, useValue: ApiURL },
      { provide: VENUE_MENU_ENABLED, useValue: menuEnabled },
    ],
  });
  return {
    http: TestBed.inject(HttpTestingController),
    repository: TestBed.inject(DrinkRepository),
    api: TestBed.inject(ProductService),
  };
}

const recipe = (id: string, extra: Partial<Recipe> = {}): Recipe => ({
  id,
  source: 'cocktaildb',
  credit: 'TheCocktailDB',
  name: `Drink ${id}`,
  ingredients: [],
  translations: [],
  hasDetails: false,
  ...extra,
});

describe('preferDetailed', () => {
  it('keeps the detailed copy of a drink, in the first copy’s place', () => {
    const merged = preferDetailed([
      recipe('1'),
      recipe('2'),
      recipe('1', { hasDetails: true, instructions: 'Shake.' }),
    ]);
    expect(merged.map(r => [r.id, r.hasDetails])).toEqual([
      ['1', true],
      ['2', false],
    ]);
  });

  it('never swaps a detailed copy for a bare one', () => {
    const merged = preferDetailed([
      recipe('1', { hasDetails: true }),
      recipe('1'),
    ]);
    expect(merged.length).toBe(1);
    expect(merged[0].hasDetails).toBeTrue();
  });

  it('never merges different ids or different sources', () => {
    const merged = preferDetailed([
      recipe('1', { name: 'Gimlet' }),
      recipe('2', { name: 'Gimlet' }),
      recipe('1', { source: 'venue-menu', name: 'Gimlet' }),
    ]);
    expect(merged.length).toBe(3);
  });
});

describe('the drinks catalogue', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('combines the browse lists with every first-letter page', async () => {
    const { http, repository } = setUp();
    const pending = firstValueFrom(repository.catalogue());
    answerLists(http, {
      Alcoholic: [listed('1', 'Abbey'), listed('2', 'Ace')],
      Non_Alcoholic: [listed('3', 'Apple Fizz')],
    });
    const asked = answerLetters(http, {
      a: [detailed('1', 'Abbey'), ...fillers('a', 24)],
      k: [detailed('4', 'Kir')],
    });
    const catalogue: Catalogue = await pending;

    expect(asked.length).toBe(36);
    const byId = new Map(catalogue.recipes.map(r => [r.id, r]));
    expect(catalogue.recipes.length).toBe(4 + 24);
    // The list copy of Abbey gave way to the detailed one.
    expect(byId.get('1')?.hasDetails).toBeTrue();
    expect(byId.get('1')?.instructions).toContain('Shake');
    // Only in a list: kept, details load when it's opened.
    expect(byId.get('2')?.hasDetails).toBeFalse();
    expect(byId.get('3')?.kind).toBe('mocktail');
    expect(catalogue.cappedLetters).toEqual(['A']);
    expect(catalogue.failedLetters).toEqual([]);
    expect(catalogue.failedLists).toBeFalse();
  });

  it('keeps what loaded when some letters or a list fail, and says which', fakeAsync(() => {
    const { http, repository, api } = setUp();
    let catalogue: Catalogue | undefined;
    repository.catalogue().subscribe(c => (catalogue = c));
    answerLists(http, {
      Alcoholic: [listed('2', 'Ace')],
      Optional_alcohol: 'fail',
    });
    const asked = answerLetters(
      http,
      { b: 'fail', '7': 'fail', k: [detailed('4', 'Kir')] },
      LETTER_RETRY_MS
    );

    // Each failed letter was tried again (twice) before giving up.
    expect(asked.filter(k => k === 'b').length).toBe(3);
    expect(catalogue!.recipes.map(r => r.id)).toEqual(['2', '4']);
    expect(catalogue!.failedLetters).toEqual(['B', '7']);
    expect(catalogue!.failedLists).toBeTrue();

    // The all-or-nothing catalogue (ingredient search, What Can I Make?) still fails,
    // and nothing partial was kept: asking again fetches every letter again.
    let failed = false;
    api.getCatalogue().subscribe({ error: () => (failed = true) });
    const again = answerLetters(http, { b: 'fail' }, LETTER_RETRY_MS);
    expect(new Set(again).size).toBe(36);
    expect(failed).toBeTrue();
  }));

  it('keeps a letter that loads on its second try', fakeAsync(() => {
    const { http, repository } = setUp();
    let catalogue: Catalogue | undefined;
    repository.catalogue().subscribe(c => (catalogue = c));
    answerLists(http, {});
    answerLetters(
      http,
      { k: attempt => (attempt === 1 ? 'fail' : [detailed('4', 'Kir')]) },
      LETTER_RETRY_MS
    );
    expect(catalogue!.failedLetters).toEqual([]);
    expect(catalogue!.recipes.map(r => r.name)).toEqual(['Kir']);
  }));

  it('loads the letters once per session when they all arrive', async () => {
    const { http, api } = setUp();
    const first = firstValueFrom(api.getCatalogue());
    answerLetters(http, { k: [detailed('4', 'Kir')] });
    expect((await first).map(d => d.idDrink)).toEqual(['4']);

    const again = firstValueFrom(api.getCatalogue());
    expect(answerLetters(http).length).toBe(0);
    expect((await again).length).toBe(1);
  });

  it('looks up drinks only the lists name, for ingredient matching', fakeAsync(() => {
    const { http, repository } = setUp();
    let catalogue: Catalogue | undefined;
    repository.detailedCatalogue().subscribe(c => (catalogue = c));
    answerLists(http, {
      Non_Alcoholic: [
        listed('12710', 'Apple Berry Smoothie'),
        listed('12656', 'Banana Milk Shake'),
      ],
    });
    answerLetters(http);
    // The lookups follow the letter pages: one per list-only drink.
    for (let round = 0; round < 5; round++) {
      for (const req of http.match(r => r.url.endsWith('lookup.php'))) {
        const id = req.request.params.get('i')!;
        if (id === '12656')
          req.flush('down', { status: 500, statusText: 'Server Error' });
        else
          req.flush({
            drinks: [
              {
                ...detailed(id, 'Apple Berry Smoothie', 'Non alcoholic'),
                strIngredient1: 'Berries',
                strIngredient2: 'Apple',
              },
            ],
          });
      }
      tick(LETTER_RETRY_MS);
    }

    const byName = new Map(catalogue!.recipes.map(r => [r.name, r]));
    const smoothie = byName.get('Apple Berry Smoothie')!;
    expect(smoothie.hasDetails).toBeTrue();
    expect(smoothie.kind).toBe('mocktail');
    expect(smoothie.ingredients.map(i => i.name)).toContain('Apple');
    // A failed lookup is kept as the bare entry and counted, never guessed.
    expect(byName.get('Banana Milk Shake')!.hasDetails).toBeFalse();
    expect(catalogue!.missingDetails).toBe(1);
  }));

  describe('with menu drinks', () => {
    // Fictional menu drinks, swapped in for the menu data.
    useVenueMenu([
      testVenueDrink('Test Lantern Sour', 'cocktail', ['gin', 'quince']),
      testVenueDrink('Test Kelp Fizz', 'zero_proof', ['kelp cordial', 'soda']),
    ]);

    it('adds the venue menu as menu descriptions when it is switched on', async () => {
      const { http, repository } = setUp(true);
      const pending = firstValueFrom(repository.catalogue());
      answerLists(http, {});
      answerLetters(http);
      const catalogue = await pending;

      const menu = catalogue.recipes.filter(r => r.source === 'venue-menu');
      expect(menu.map(r => r.name)).toEqual(
        jasmine.arrayWithExactContents(['Test Lantern Sour', 'Test Kelp Fizz'])
      );
      expect(menu.every(r => r.completeness === 'menu-description')).toBeTrue();
    });

    it('leaves the venue menu out when it is switched off', async () => {
      const { http, repository } = setUp(false);
      const pending = firstValueFrom(repository.catalogue());
      answerLists(http, {});
      answerLetters(http);
      expect((await pending).recipes).toEqual([]);
    });
  });

  // The published menu data.
  describe('with the menu data', () => {
    requireRealVenueMenu();

    it('adds every published menu drink as a menu description', async () => {
      const { http, repository } = setUp(true);
      const pending = firstValueFrom(repository.catalogue());
      answerLists(http, {});
      answerLetters(http);
      const menu = (await pending).recipes.filter(
        r => r.source === 'venue-menu'
      );
      expect(menu.length).toBe(VENUE_MENU_DRINKS.length);
      expect(menu.every(r => r.completeness === 'menu-description')).toBeTrue();
    });
  });
});
