import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductDetailsComponent } from './product-details.component';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import {
  API_URL,
  ApiURL,
  PRODUCT_DETIAL_CONFIG_DATA,
  ProductDetailConfig,
} from '../../config/product.config';
import { CocktailDbSource } from '../../data/cocktaildb.source';
import { CuratedSource } from '../../data/curated.source';
import { DrinkRepository } from '../../data/drink.repository';
import { ProductService } from '../../services/product.service';
import { ProductsStore } from '../../store/product.store';

describe('ProductDetailsComponent', () => {
  let component: ProductDetailsComponent;
  let fixture: ComponentFixture<ProductDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductDetailsComponent],
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
          provide: PRODUCT_DETIAL_CONFIG_DATA,
          useValue: ProductDetailConfig,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
