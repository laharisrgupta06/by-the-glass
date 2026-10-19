import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Component, DebugElement } from '@angular/core';

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

  it('leads to the drink’s page by default, or to the link it’s given', () => {
    const anchor = () =>
      fixture.nativeElement.querySelector('a.drink-card') as HTMLAnchorElement;
    expect(anchor().getAttribute('href')).toBe('/product-details/16082');
    fixture.componentRef.setInput('link', ['/personal/recipes', 'abc']);
    fixture.componentRef.setInput('description', 'Rich and nutty.');
    fixture.detectChanges();
    expect(anchor().getAttribute('href')).toBe('/personal/recipes/abc');
    expect(anchor().querySelector('.description')!.textContent).toContain(
      'Rich and nutty.'
    );
  });
});

@Component({
  standalone: true,
  imports: [ProductCardComponent],
  template: `<app-product-card
    [recipe]="recipe"
    [link]="['/personal/recipes', 'abc']">
    <div card-actions>
      <button type="button" (click)="clicks = clicks + 1">Edit</button>
    </div>
  </app-product-card>`,
})
class HostComponent {
  recipe = {
    id: 'abc',
    source: 'own',
    name: 'Garden Spritz',
    ingredients: [],
    translations: [],
    hasDetails: true,
  } as unknown as Recipe;
  clicks = 0;
}

describe('ProductCardComponent actions', () => {
  it('places actions beside the card’s link, never inside it', () => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector(
      '[card-actions] button'
    ) as HTMLButtonElement;
    expect(button.closest('a')).toBeNull();
    button.click();
    expect(fixture.componentInstance.clicks).toBe(1);
  });
});
