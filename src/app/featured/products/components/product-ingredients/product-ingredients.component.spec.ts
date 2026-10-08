import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductIngredientsComponent } from './product-ingredients.component';
import { Recipe } from '../../models/recipe.model';

const recipe: Recipe = {
  id: '11007',
  source: 'cocktaildb',
  credit: 'TheCocktailDB',
  name: 'Margarita',
  kind: 'cocktail',
  glass: 'Cocktail glass',
  ingredients: [
    { name: 'Tequila', measure: '1 1/2 oz' },
    { name: 'Triple sec', measure: '1/2 oz' },
    { name: 'Salt' },
  ],
  instructions:
    'Rub the rim of the glass with lime. Shake with ice and strain.',
  translations: [{ lang: 'es', label: 'Español', text: 'Agitar.' }],
  hasDetails: true,
};

describe('ProductIngredientsComponent', () => {
  let component: ProductIngredientsComponent;
  let fixture: ComponentFixture<ProductIngredientsComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductIngredientsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductIngredientsComponent);
    component = fixture.componentInstance;
    component.ingredients = recipe.ingredients;
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows measurement then ingredient, without inventing missing amounts', () => {
    const rows = Array.from(element.querySelectorAll('li'));
    expect(rows[0].textContent).toContain('1 1/2 oz');
    expect(rows[0].textContent).toContain('≈ 45 ml');
    expect(rows[2].querySelector('.measure')?.textContent?.trim()).toBe('');
    expect(element.querySelector('.note')).toBeTruthy();
  });
});
