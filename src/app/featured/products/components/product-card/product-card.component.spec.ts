import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DebugElement } from '@angular/core';

import { ProductCardComponent } from './product-card.component';
import { Recipe } from '../../models/recipe.model';

describe('ProductCardComponent', () => {
  let component: ProductCardComponent;
  let fixture: ComponentFixture<ProductCardComponent>;
  const mockRecipe: Recipe = {
    id: '16082',
    source: 'cocktaildb',
    credit: 'TheCocktailDB',
    name: 'Almond Chocolate Coffee',
    thumbnail:
      'https://www.thecocktaildb.com/images/media/drink/jls02c1493069441.jpg/medium',
    ingredients: [],
    translations: [],
    hasDetails: false,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCardComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductCardComponent);
    component = fixture.componentInstance;
    component.recipe = mockRecipe;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should showcase drink name', () => {
    expect(component).toBeTruthy();
    const productDe: DebugElement = fixture.debugElement;
    const productEl: HTMLElement = productDe.nativeElement;
    const p = productEl.querySelector('h2')!;
    expect(p.textContent).toContain('Almond Chocolate Coffee');
  });
});
