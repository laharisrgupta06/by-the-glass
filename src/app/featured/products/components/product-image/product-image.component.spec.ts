import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductImageComponent } from './product-image.component';
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

describe('ProductImageComponent', () => {
  let component: ProductImageComponent;
  let fixture: ComponentFixture<ProductImageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductImageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductImageComponent);
    component = fixture.componentInstance;
    component.src = 'https://example.com/drink.jpg';
    component.alt = recipe.name;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('labels the photo with the drink name', () => {
    const img: HTMLImageElement = fixture.nativeElement.querySelector('img');
    expect(img.alt).toBe('Margarita');
  });
});
