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

  it('can render the name as a level-2 heading inside another page', () => {
    component.headingLevel = 2;
    fixture.detectChanges();
    expect(element.querySelector('h1')).toBeNull();
    expect(element.querySelector('h2')!.textContent).toContain('Margarita');
  });

  it('shows a description when the drink has one, and none otherwise', () => {
    expect(element.querySelector('.description')).toBeNull();
    component.recipe = {
      ...recipe,
      description: 'A sour tequila cocktail with triple sec and lime juice.',
    };
    fixture.detectChanges();
    expect(element.querySelector('.description')!.textContent).toContain(
      'A sour tequila cocktail with triple sec and lime juice.'
    );
  });

  it('lists ice and serving only when an approximate recipe gives them', () => {
    component.recipe = {
      ...recipe,
      completeness: 'approximate',
      ice: 'Shaken with ice; served without',
      serving: 'Straight up',
    };
    fixture.detectChanges();
    const labels = Array.from(element.querySelectorAll('dt')).map(
      dt => dt.textContent
    );
    expect(labels).toEqual(['Glass', 'Ice', 'Serving']);
  });

  it('shows derived taste, ice and serving for TheCocktailDB, and says where they come from', () => {
    component.recipe = {
      ...recipe,
      tastes: ['sour'],
      ice: 'Shaken with ice; strained',
    };
    fixture.detectChanges();
    const labels = Array.from(element.querySelectorAll('dt')).map(
      dt => dt.textContent
    );
    expect(labels).toEqual(['Taste', 'Glass', 'Ice']);
    expect(element.querySelector('dd')!.textContent).toBe('Sour');
    expect(element.querySelector('.derived')!.textContent).toContain(
      'Taste and ice are read from the recipe’s ingredients and method.'
    );
  });

  it('adds no such note to venue drinks or recipes without derived details', () => {
    expect(element.querySelector('.derived')).toBeNull();
    component.recipe = { ...recipe, source: 'venue-menu', ice: 'Over ice' };
    fixture.detectChanges();
    expect(element.querySelector('.derived')).toBeNull();
  });
});
