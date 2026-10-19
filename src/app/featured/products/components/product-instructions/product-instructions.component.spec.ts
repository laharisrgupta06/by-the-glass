import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductInstructionsComponent } from './product-instructions.component';
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

describe('ProductInstructionsComponent', () => {
  let component: ProductInstructionsComponent;
  let fixture: ComponentFixture<ProductInstructionsComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductInstructionsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductInstructionsComponent);
    component = fixture.componentInstance;
    component.instructions = recipe.instructions;
    component.translations = recipe.translations;
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows English steps with translations tucked away', () => {
    expect(element.querySelectorAll('.steps li').length).toBe(2);
    expect(element.querySelector('details')?.hasAttribute('open')).toBeFalse();
  });
});
