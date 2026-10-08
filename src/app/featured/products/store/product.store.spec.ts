import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { API_URL, ApiURL } from '../config/product.config';
import { CocktailDbSource } from '../data/cocktaildb.source';
import { CuratedSource } from '../data/curated.source';
import { DrinkRepository } from '../data/drink.repository';
import { ProductService } from '../services/product.service';
import { ProductsStore } from './product.store';

describe('ProductsStore', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProductsStore,
        ProductService,
        DrinkRepository,
        CocktailDbSource,
        CuratedSource,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: ApiURL },
      ],
    });
  });

  it('should be created', () => {
    expect(TestBed.inject(ProductsStore)).toBeTruthy();
  });
});
