import { PLATFORM_ID } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { API_URL, ApiURL } from '../config/product.config';
import { CocktailDbSource } from '../data/cocktaildb.source';
import { CuratedSource } from '../data/curated.source';
import { DrinkRepository } from '../data/drink.repository';
import {
  COCKTAILDB_TIMEOUT_MS,
  cocktailDbTimeoutInterceptor,
} from '../services/cocktaildb-timeout.interceptor';
import {
  LETTER_RETRY_MS,
  ProductService,
  clearCatalogueCache,
} from '../services/product.service';
import { VENUE_MENU_ENABLED } from '../data/venue-menu/venue-menu.source';
import {
  answerLetters,
  answerLists,
  detailed,
  fillers,
  listed,
} from '../testing/catalogue-http';
import { ProductsStore } from './product.store';

function setUp(platform: 'browser' | 'server' = 'browser') {
  clearCatalogueCache();
  TestBed.configureTestingModule({
    providers: [
      ProductsStore,
      ProductService,
      DrinkRepository,
      CocktailDbSource,
      CuratedSource,
      provideHttpClient(withInterceptors([cocktailDbTimeoutInterceptor])),
      provideHttpClientTesting(),
      { provide: API_URL, useValue: ApiURL },
      { provide: PLATFORM_ID, useValue: platform },
      { provide: VENUE_MENU_ENABLED, useValue: false },
    ],
  });
  return {
    store: TestBed.inject(ProductsStore),
    controller: TestBed.inject(HttpTestingController),
  };
}

const BROWSE = { q: '', letter: '', spirit: '' };
const LISTS = { Alcoholic: [listed('1', 'Abbey'), listed('2', 'Ace')] };

describe('ProductsStore', () => {
  it('should be created', () => {
    expect(setUp().store).toBeTruthy();
  });

  describe('when TheCocktailDB is slow', () => {
    it('keeps the loading state while rendering on the server', fakeAsync(() => {
      const { store, controller } = setUp('server');
      store.loadDrinks(BROWSE);
      store.loadRecipe('11007');

      tick(COCKTAILDB_TIMEOUT_MS.server);
      expect(store.status()).toBe('loading');
      expect(store.recipeStatus()).toBe('loading');
      // Every request was given up on, not left waiting.
      controller.verify({ ignoreCancelled: true });
    }));

    it('shows the error in the browser, where it can be retried', fakeAsync(() => {
      const { store, controller } = setUp('browser');
      store.loadDrinks(BROWSE);
      store.loadRecipe('11007');

      tick(COCKTAILDB_TIMEOUT_MS.browser);
      expect(store.status()).toBe('error');
      expect(store.recipeStatus()).toBe('error');
      controller.verify({ ignoreCancelled: true });
    }));

    it('still reports real errors on the server', fakeAsync(() => {
      const { store, controller } = setUp('server');
      store.loadRecipe('11007');

      controller
        .expectOne(req => req.url.endsWith('lookup.php'))
        .flush('down', { status: 503, statusText: 'Unavailable' });
      expect(store.recipeStatus()).toBe('error');
      controller.verify();
    }));
  });

  describe('the full catalogue', () => {
    it('merges every reachable drink in after the browse lists, in the browser', () => {
      const { store, controller } = setUp('browser');
      store.loadDrinks(BROWSE);
      answerLists(controller, LISTS);
      expect(store.status()).toBe('ready');
      expect(store.catalogueStatus()).toBe('loading');

      answerLists(controller, LISTS);
      answerLetters(controller, {
        a: [detailed('1', 'Abbey'), ...fillers('a', 24)],
        k: [detailed('4', 'Kir')],
      });
      expect(store.catalogueStatus()).toBe('ready');
      expect(store.cappedLetters()).toEqual(['A']);
      const byId = new Map(store.recipes().map(r => [r.id, r]));
      expect(store.recipes().length).toBe(2 + 24 + 1);
      expect(byId.get('1')?.hasDetails).toBeTrue();
      expect(byId.get('2')?.hasDetails).toBeFalse();
      controller.verify();
    });

    it('only renders the browse lists on the server', () => {
      const { store, controller } = setUp('server');
      store.loadDrinks(BROWSE);
      answerLists(controller, LISTS);
      expect(store.status()).toBe('ready');
      expect(store.catalogueStatus()).toBe('idle');
      expect(store.recipes().length).toBe(2);
      controller.verify();
    });

    it('keeps the first results and reports what failed', fakeAsync(() => {
      const { store, controller } = setUp('browser');
      store.loadDrinks(BROWSE);
      answerLists(controller, LISTS);
      answerLists(controller, { ...LISTS, Optional_alcohol: 'fail' });
      answerLetters(
        controller,
        { b: 'fail', k: [detailed('4', 'Kir')] },
        LETTER_RETRY_MS
      );

      expect(store.status()).toBe('ready');
      expect(store.catalogueStatus()).toBe('partial');
      expect(store.failedLetters()).toEqual(['B']);
      expect(store.failedLists()).toBeTrue();
      expect(store.recipes().map(r => r.id)).toEqual(['1', '2', '4']);
      controller.verify();
    }));

    it('adds list-only drinks to a letter, beyond its 25-drink page', () => {
      const { store, controller } = setUp('browser');
      store.loadDrinks({ ...BROWSE, letter: 'A' });
      controller
        .expectOne(r => r.params.get('f') === 'A')
        .flush({ drinks: [detailed('1', 'Abbey')] });
      answerLists(controller, LISTS);
      answerLetters(controller, { a: [detailed('1', 'Abbey')] });

      expect(store.recipes().map(r => r.id)).toEqual(['1', '2']);
      controller.verify();
    });

    it('adds name and ingredient matches the API search cut off', () => {
      const { store, controller } = setUp('browser');
      store.loadDrinks({ ...BROWSE, q: 'kir' });
      controller
        .expectOne(r => r.params.get('s') === 'kir')
        .flush({ drinks: [detailed('4', 'Kir')] });
      expect(store.ingredientStatus()).toBe('loading');

      answerLists(controller, { Alcoholic: [listed('5', 'Kir Royale')] });
      answerLetters(controller, {
        k: [detailed('4', 'Kir'), detailed('6', 'Kiwi Cooler')],
        m: [{ ...detailed('7', 'Mule'), strIngredient1: 'Kir syrup' }],
      });
      expect(store.recipes().map(r => r.name)).toEqual([
        'Kir',
        'Kir Royale',
        'Mule',
      ]);
      expect(store.ingredientStatus()).toBe('ready');
      controller.verify();
    });
  });
});
