import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
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
});
