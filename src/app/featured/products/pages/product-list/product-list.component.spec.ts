import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { CocktailDbSource } from '../../data/cocktaildb.source';
import { CuratedSource } from '../../data/curated.source';
import { DrinkRepository } from '../../data/drink.repository';
import { ProductListComponent } from './product-list.component';
import { ProductService } from '../../services/product.service';
import {
  API_URL,
  ApiURL,
  PRODUCT_LIST_CONFIG_DATA,
  ProductListConfig,
} from '../../config/product.config';
import { ProductsStore } from '../../store/product.store';
import { patchState } from '@ngrx/signals';
import { Recipe } from '../../models/recipe.model';
import { fromVenueMenu } from '../../data/venue-menu/venue-menu.source';
import { testVenueDrink } from '../../testing/venue-menu.testing';

// Fictional menu drinks, two starting with K.
const TEST_MENU = [
  testVenueDrink(
    'Kestrel Kick',
    'cocktail',
    ['tequila', 'rhubarb'],
    [],
    'Test Cocktails'
  ),
  testVenueDrink(
    'Kelp Fizz',
    'mocktail',
    ['kelp cordial', 'soda'],
    [],
    'Test Mocktails'
  ),
];

describe('ProductListComponent', () => {
  let component: ProductListComponent;
  let fixture: ComponentFixture<ProductListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductListComponent],
      providers: [
        ProductsStore,
        ProductService,
        DrinkRepository,
        CocktailDbSource,
        CuratedSource,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_URL, useValue: ApiURL },
        {
          provide: PRODUCT_LIST_CONFIG_DATA,
          useValue: ProductListConfig,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('with venue-menu drinks loaded', () => {
    const fromApi = (n: number): Recipe[] =>
      Array.from({ length: n }, (_, i) => ({
        id: String(17000 + i),
        source: 'cocktaildb',
        credit: 'TheCocktailDB',
        name: `K Drink ${i}`,
        kind: 'cocktail',
        ingredients: [
          { name: 'Gin', measure: '1 oz' },
          { name: 'Lime juice', measure: '1 oz' },
          { name: 'Sugar syrup', measure: '1 oz' },
        ],
        instructions: 'Shake with ice and strain into a chilled glass.',
        translations: [],
        hasDetails: true,
      }));
    const menuK = TEST_MENU.filter(d => d.name.startsWith('K')).map(
      fromVenueMenu
    );

    async function showLetterK(recipes: Recipe[]) {
      await TestBed.inject(Router).navigate([], {
        queryParams: { letter: 'K' },
      });
      patchState(TestBed.inject(ProductsStore) as never, {
        recipes,
        status: 'ready',
      });
      fixture.detectChanges();
    }

    const capNote = () =>
      component
        .notes()
        .some(n => n.includes('only lists some drinks starting with K'));

    it('does not let menu drinks trigger TheCocktailDB letter-cap note', async () => {
      await showLetterK([...fromApi(24), ...menuK]);
      expect(capNote()).toBeFalse();
      await showLetterK(fromApi(25));
      expect(capNote()).toBeTrue();
    });

    it('falls back to the page size when the letter’s own page failed', async () => {
      await showLetterK(fromApi(25));
      patchState(TestBed.inject(ProductsStore) as never, {
        catalogueStatus: 'partial',
        failedLetters: ['K'],
        cappedLetters: [],
      });
      expect(capNote()).toBeTrue();
    });

    it('uses the capped letters once the full catalogue has loaded', async () => {
      await showLetterK(fromApi(25));
      const store = TestBed.inject(ProductsStore) as never;
      patchState(store, { catalogueStatus: 'ready', cappedLetters: ['S'] });
      expect(capNote()).toBeFalse();
      patchState(store, { cappedLetters: ['K', 'S'] });
      expect(capNote()).toBeTrue();
    });

    it('labels venue drinks like any other drink, with their section', async () => {
      await showLetterK(menuK);
      const details = component
        .cards()
        .map(c => `${c.recipe.name}: ${c.detail}`);
      expect(details).toContain('Kestrel Kick: Cocktail · Test Cocktails');
      expect(details).toContain('Kelp Fizz: Mocktail · Test Mocktails');
      expect(details.join(' ')).not.toContain('Menu description');
    });
  });

  describe('the full catalogue', () => {
    async function showAll(state: Record<string, unknown>) {
      await TestBed.inject(Router).navigate([], { queryParams: {} });
      patchState(TestBed.inject(ProductsStore) as never, {
        recipes: [
          ...TEST_MENU.map(fromVenueMenu),
          {
            id: '11007',
            source: 'cocktaildb',
            credit: 'TheCocktailDB',
            name: 'Margarita',
            kind: 'cocktail',
            ingredients: [],
            translations: [],
            hasDetails: false,
          },
        ],
        status: 'ready',
        ...state,
      });
      fixture.detectChanges();
    }
    const text = () => fixture.nativeElement.textContent as string;

    it('says it is still loading the rest', async () => {
      await showAll({ catalogueStatus: 'loading' });
      expect(component.notes()).toContain('Loading the rest of the catalogue…');
    });

    it('names its sources and the free API caps honestly, without the old 100 note', async () => {
      await showAll({
        catalogueStatus: 'ready',
        cappedLetters: ['A', 'B', 'S'],
      });
      const notes = component.notes().join(' ');
      expect(notes).toContain(
        'Every drink we can reach from the venue menu and TheCocktailDB’s free API.'
      );
      expect(notes).toContain('may be more drinks starting with A, B and S');
      expect(notes).not.toContain('100');
      expect(notes).not.toContain('Loading');
      expect(component.catalogueGap()).toBe('');
    });

    it('says which letters failed, and offers to try again', async () => {
      await showAll({
        catalogueStatus: 'partial',
        failedLetters: ['B', '7'],
        failedLists: false,
      });
      expect(component.catalogueGap()).toBe(
        "Couldn't load drinks starting with B and 7 just now."
      );
      const store = TestBed.inject(ProductsStore);
      spyOn(store, 'loadDrinks');
      const retry = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('button')
      ).find(b => b.textContent?.includes('Try again'));
      expect(text()).toContain('drinks starting with B and 7');
      retry!.click();
      expect(store.loadDrinks).toHaveBeenCalled();
    });

    it('counts the failed letters once listing them would be hard to read', async () => {
      await showAll({
        catalogueStatus: 'partial',
        failedLetters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
        failedLists: false,
      });
      expect(component.catalogueGap()).toBe(
        "Couldn't load drinks for 8 of the 36 letters and digits just now."
      );
    });

    it('explains a failed list', async () => {
      await showAll({
        catalogueStatus: 'partial',
        failedLetters: [],
        failedLists: true,
      });
      expect(component.catalogueGap()).toBe(
        "Couldn't load part of the catalogue just now."
      );
    });

    it('keeps venue drinks in the merged list, opening their own pages', async () => {
      await showAll({ catalogueStatus: 'ready' });
      const menu = component
        .cards()
        .filter(c => c.recipe.source === 'venue-menu');
      expect(menu.length).toBe(2);
      expect(menu.every(c => c.recipe.id.startsWith('bg-menu-'))).toBeTrue();
      expect(
        menu.every(c => !c.detail.includes('Menu description'))
      ).toBeTrue();
    });
  });
});
