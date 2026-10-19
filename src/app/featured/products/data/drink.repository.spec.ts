import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { API_URL, ApiURL } from '../config/product.config';
import { ProductService } from '../services/product.service';
import { CocktailDbSource } from './cocktaildb.source';
import { CuratedSource } from './curated.source';
import { DrinkRepository } from './drink.repository';
import { useVenueMenu } from '../testing/venue-menu.testing';
import { VenueMenuDrink } from './venue-menu/venue-menu.data';
import { VENUE_MENU_ENABLED } from './venue-menu/venue-menu.source';

// Fictional menu drinks, swapped in for the menu data during these tests.
const TEST_MENU: VenueMenuDrink[] = [
  {
    id: 'bg-menu-test-cloudberry-fizz',
    name: 'Test Cloudberry Fizz',
    section: 'Test Section',
    kind: 'zero_proof',
    ingredients: ['cloudberry cordial', 'soda'],
    flavourNotes: ['fruity'],
  },
  {
    id: 'bg-menu-test-saffron-lassi',
    name: 'Test Saffron Lassi',
    section: 'Test Section',
    kind: 'mocktail',
    ingredients: ['saffron syrup', 'yoghurt'],
    flavourNotes: ['sweet'],
  },
];

describe('DrinkRepository with the venue menu', () => {
  let repository: DrinkRepository;
  let http: HttpTestingController;
  useVenueMenu(TEST_MENU);

  function setUp(menuEnabled: boolean) {
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
    repository = TestBed.inject(DrinkRepository);
    http = TestBed.inject(HttpTestingController);
  }

  afterEach(() => http.verify());

  it('resolves a fixed menu id without calling TheCocktailDB', async () => {
    setUp(true);
    const recipe = await firstValueFrom(
      repository.byId('bg-menu-test-cloudberry-fizz')
    );
    expect(recipe?.name).toBe('Test Cloudberry Fizz');
    expect(recipe?.source).toBe('venue-menu');
    http.expectNone(() => true);
  });

  it('still looks TheCocktailDB ids up exactly as before', async () => {
    setUp(true);
    const pending = firstValueFrom(repository.byId('11007'));
    const req = http.expectOne(r => r.url.includes('lookup.php'));
    expect(req.request.params.get('i')).toBe('11007');
    req.flush({
      drinks: [
        {
          idDrink: '11007',
          strDrink: 'Margarita',
          strDrinkThumb: 'x',
          strInstructions: 'Shake.',
        },
      ],
    });
    const recipe = await pending;
    expect(recipe?.source).toBe('cocktaildb');
    expect(recipe?.name).toBe('Margarita');
  });

  it('adds menu drinks to name search alongside TheCocktailDB results', async () => {
    setUp(true);
    const pending = firstValueFrom(repository.searchByName('lassi'));
    http
      .expectOne(r => r.url.includes('search.php'))
      .flush({
        drinks: [
          {
            idDrink: '12690',
            strDrink: 'Lassi - Mango',
            strDrinkThumb: 'x',
            strInstructions: 'Blend.',
          },
        ],
      });
    const results = await pending;
    expect(results.map(r => `${r.source}:${r.name}`)).toEqual(
      jasmine.arrayWithExactContents([
        'venue-menu:Test Saffron Lassi',
        'cocktaildb:Lassi - Mango',
      ])
    );
  });

  it('leaves out every menu drink when switched off', async () => {
    setUp(false);
    // The id is no longer known locally, so the lookup falls through to TheCocktailDB.
    const lookup = firstValueFrom(
      repository.byId('bg-menu-test-cloudberry-fizz')
    );
    http.expectOne(r => r.url.includes('lookup.php')).flush({ drinks: null });
    expect(await lookup).toBeUndefined();
    const search = firstValueFrom(repository.searchByName('lassi'));
    http.expectOne(r => r.url.includes('search.php')).flush({ drinks: null });
    expect(await search).toEqual([]);
  });
});
