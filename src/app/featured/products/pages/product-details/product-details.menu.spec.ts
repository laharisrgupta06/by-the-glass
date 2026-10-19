import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import {
  API_URL,
  ApiURL,
  PRODUCT_DETIAL_CONFIG_DATA,
  ProductDetailConfig,
} from '../../config/product.config';
import { CocktailDbSource } from '../../data/cocktaildb.source';
import { CuratedSource } from '../../data/curated.source';
import { DrinkRepository } from '../../data/drink.repository';
import { VENUE_MENU_ENABLED } from '../../data/venue-menu/venue-menu.source';
import { testVenueDrink, useVenueMenu } from '../../testing/venue-menu.testing';
import { ProductService } from '../../services/product.service';
import { ProductsStore } from '../../store/product.store';
import { ProductDetailsComponent } from './product-details.component';
import { MENU_PATHS } from 'src/app/core/ai/ai-recipe';

// A fictional menu drink, swapped in for the menu data. As a menu lists it.
const MENU_DRINK = testVenueDrink(
  'Kelp Fizz',
  'zero_proof',
  ['non-alcoholic rum', 'kelp spice mix'],
  ['spicy', 'fruity'],
  'Test Zero Proof'
);
const MENU_ID = MENU_DRINK.id;
const MENU_INGREDIENTS = MENU_DRINK.ingredients;

/** What our server stores for a menu drink once its recipe has been created. */
const STORED = {
  drinkId: MENU_ID,
  drinkName: 'Kelp Fizz',
  menuIngredients: MENU_INGREDIENTS,
  recipe: {
    name: 'Kelp Fizz',
    kind: 'mocktail',
    description: 'Tart and spiced, with dark berry fruit.',
    ingredients: [
      {
        name: 'non-alcoholic rum',
        amount: '50 ml',
        origin: 'given',
        optional: false,
      },
      {
        name: 'kelp spice mix',
        amount: '1 pinch',
        origin: 'given',
        optional: false,
      },
      { name: 'Lime juice', amount: '20 ml', origin: 'extra', optional: false },
      { name: 'Sugar syrup', amount: '10 ml', origin: 'extra', optional: true },
    ],
    steps: [
      'Shake everything hard with ice.',
      'Double strain into a chilled coupe.',
    ],
    glass: 'Coupe',
    ice: 'Shake with ice; serve without.',
    garnish: 'Lime wheel',
    serving: 'Serve straight away.',
  },
  model: 'gemini',
  createdAt: '2026-10-19T12:00:00.000Z',
};

/** The details page reached the way a link or bookmark reaches it: by URL. */
describe('drink details by URL', () => {
  useVenueMenu([MENU_DRINK]);
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  const text = () =>
    (harness.routeNativeElement as HTMLElement).textContent!.replace(
      /\s+/g,
      ' '
    );

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'product-details/:id',
            component: ProductDetailsComponent,
            providers: [
              ProductsStore,
              DrinkRepository,
              CuratedSource,
              CocktailDbSource,
              ProductService,
            ],
          },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: ApiURL },
        { provide: PRODUCT_DETIAL_CONFIG_DATA, useValue: ProductDetailConfig },
        { provide: VENUE_MENU_ENABLED, useValue: true },
      ],
    });
    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const el = () => harness.routeNativeElement as HTMLElement;
  const rows = () =>
    Array.from(el().querySelectorAll('app-product-ingredients li')).map(li =>
      li.textContent!.replace(/\s+/g, ' ').trim()
    );
  const count = (needle: string) => text().split(needle).length - 1;

  it('keeps an honest fallback for a venue drink with no recipe yet', async () => {
    await harness.navigateByUrl(`/product-details/${MENU_ID}`);
    http.expectNone(r => r.url.includes('thecocktaildb')); // resolved locally
    http
      .expectOne(MENU_PATHS.extras(MENU_ID))
      .flush({ recipe: null, illustration: null, canCreateRecipe: true });
    harness.detectChanges();
    const page = text();
    expect(page).toContain('Kelp Fizz');
    expect(page).toContain(
      'Zero-proof cocktail · Test Zero Proof · Menu description'
    );
    expect(page).toContain(
      'A spicy, fruity zero-proof cocktail of non-alcoholic rum and kelp spice mix.'
    );
    expect(rows()).toEqual(['non-alcoholic rum', 'kelp spice mix']);
    expect(page).toContain('The venue doesn’t list amounts.');
    // Said once, plainly; no contradictory or repeated notices.
    expect(count('No method yet')).toBe(1);
    expect(page).not.toContain('This is a menu description, not a recipe.');
    expect(page).not.toContain('AI-curated recipe');
    expect(page).toContain('Suggest an approximate recipe');
    expect(page).toContain('No photo');
    expect(el().querySelector('app-ai-recipe-card')).toBeNull();
    // Nothing invented.
    for (const absent of ['Glass', 'Garnish', 'Serves', ' oz', ' ml'])
      expect(page).not.toContain(absent);
    expect(el().querySelector('app-favorite-button')).not.toBeNull();
  });

  it('shows a stored recipe in the usual layout, with one quiet disclosure', async () => {
    await harness.navigateByUrl(`/product-details/${MENU_ID}`);
    http.expectOne(MENU_PATHS.extras(MENU_ID)).flush({
      recipe: STORED,
      illustration: {
        url: MENU_PATHS.illustration(MENU_ID),
        model: 'supplied',
        createdAt: '2026-10-19T12:00:00.000Z',
      },
      canCreateRecipe: true,
    });
    harness.detectChanges();
    const page = text();
    expect(page).toContain('Kelp Fizz');
    expect(page).toContain(
      'A spicy, fruity zero-proof cocktail of non-alcoholic rum and kelp spice mix.'
    );
    expect(page).toContain('Zero-proof cocktail · Test Zero Proof');
    expect(page).not.toContain('Menu description');
    expect(rows()).toEqual([
      '50 ml non-alcoholic rum',
      '1 pinch kelp spice mix',
      '20 ml Lime juice addition',
      '10 ml Sugar syrup optional addition',
    ]);
    const steps = Array.from(
      el().querySelectorAll('app-product-instructions li')
    ).map(li => li.textContent!.trim());
    expect(steps).toEqual(STORED.recipe.steps);
    for (const fact of [
      'GlassCoupe',
      'IceShake with ice; serve without.',
      'GarnishLime wheel',
      'ServingServe straight away.',
    ])
      expect(page.replace(/ /g, '')).toContain(fact.replace(/ /g, ''));
    // One subtle disclosure, no separate card, no "no recipe" notices.
    const note = el().querySelector('.approximation')!;
    expect(note.textContent).toContain(
      'AI-suggested approximation based on the venue’s ingredient list, not verified by the venue.'
    );
    expect(count('approximation')).toBe(1);
    expect(el().querySelector('app-ai-recipe-card')).toBeNull();
    expect(el().querySelector('app-menu-curation')).toBeNull();
    expect(page).not.toContain('AI-curated recipe');
    expect(page).not.toContain('No method yet');
    expect(page).not.toContain('The venue doesn’t list amounts.');
    // A supplied illustration, labelled as one.
    const img = el().querySelector('app-product-image img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(MENU_PATHS.illustration(MENU_ID));
    expect(
      el().querySelector('app-product-image .caption')!.textContent
    ).toContain('AI-generated illustration');
  });

  it('suggests a recipe only when asked, and says so honestly when it fails', async () => {
    await harness.navigateByUrl(`/product-details/${MENU_ID}`);
    http
      .expectOne(MENU_PATHS.extras(MENU_ID))
      .flush({ recipe: null, illustration: null, canCreateRecipe: true });
    harness.detectChanges();
    http.expectNone(MENU_PATHS.recipe(MENU_ID));
    el().querySelector<HTMLButtonElement>('button.suggest')!.click();
    harness.detectChanges();
    expect(text()).toContain('Working out approximate amounts');
    http
      .expectOne(
        r => r.method === 'POST' && r.url === MENU_PATHS.recipe(MENU_ID)
      )
      .flush(
        { error: 'quota' },
        { status: 429, statusText: 'Too Many Requests' }
      );
    harness.detectChanges();
    expect(text()).toContain(
      'The Gemini usage limit for this key has been reached, so no recipe was suggested.'
    );
    expect(text()).not.toContain('50 ml');

    el().querySelector<HTMLButtonElement>('.text-button')!.click();
    http
      .expectOne(
        r => r.method === 'POST' && r.url === MENU_PATHS.recipe(MENU_ID)
      )
      .flush(STORED, { status: 201, statusText: 'Created' });
    harness.detectChanges();
    expect(rows()[0]).toBe('50 ml non-alcoholic rum');
    expect(el().querySelector('.approximation')).not.toBeNull();
  });

  it('shows TheCocktailDB recipes as before, plus a description from their own data', async () => {
    await harness.navigateByUrl('/product-details/11007');
    http
      .expectOne(r => r.url.includes('lookup.php'))
      .flush({
        drinks: [
          {
            idDrink: '11007',
            strDrink: 'Margarita',
            strDrinkThumb: 'https://example.com/m.jpg',
            strAlcoholic: 'Alcoholic',
            strCategory: 'Ordinary Drink',
            strGlass: 'Cocktail glass',
            strInstructions:
              'Rub the rim of the glass with lime. Shake with ice and strain.',
            strIngredient1: 'Tequila',
            strMeasure1: '1 1/2 oz',
            strIngredient2: 'Triple sec',
            strMeasure2: '1/2 oz',
            strIngredient3: 'Lime juice',
            strMeasure3: '1 oz',
          },
        ],
      });
    harness.detectChanges();
    const page = text();
    expect(page).toContain('Margarita');
    expect(page).toContain(
      'A sour tequila cocktail with triple sec and lime juice, served in a cocktail glass.'
    );
    expect(page).toContain('Recipe from TheCocktailDB');
    expect(page).toContain('1 1/2 oz');
    expect(page).toContain('Rub the rim of the glass with lime.');
    expect(page).not.toContain('Menu description');
    expect(page).not.toContain('No photo');
    // Catalogue drinks never get venue extras: same photo, no caption, no disclosure.
    http.expectNone(r => r.url.startsWith('/api/venue-menu'));
    expect(
      el().querySelector('app-product-image img')!.getAttribute('src')
    ).toBe('https://example.com/m.jpg');
    expect(el().querySelector('app-product-image .caption')).toBeNull();
    expect(el().querySelector('app-menu-curation')).toBeNull();
    expect(el().querySelector('.approximation')).toBeNull();
  });
});
