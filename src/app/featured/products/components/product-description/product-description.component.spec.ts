import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductDescriptionComponent } from './product-description.component';
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

describe('ProductDescriptionComponent', () => {
  let component: ProductDescriptionComponent;
  let fixture: ComponentFixture<ProductDescriptionComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductDescriptionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductDescriptionComponent);
    component = fixture.componentInstance;
    component.recipe = recipe;
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the name and only facts the source provides', () => {
    expect(element.querySelector('h1')?.textContent).toContain('Margarita');
    const labels = Array.from(element.querySelectorAll('dt')).map(
      dt => dt.textContent
    );
    expect(labels).toEqual(['Glass']);
  });
});
