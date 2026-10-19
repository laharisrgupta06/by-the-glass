import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Recipe } from '../../../products/models/recipe.model';
import { SurprisePanelComponent } from './surprise-panel.component';

const margarita: Recipe = {
  id: '11007',
  source: 'cocktaildb',
  credit: 'TheCocktailDB',
  name: 'Margarita',
  kind: 'cocktail',
  image: 'https://example.com/margarita.jpg',
  ingredients: [
    { name: 'Tequila', measure: '1 1/2 oz' },
    { name: 'Triple sec', measure: '1/2 oz' },
    { name: 'Lime juice', measure: '1 oz' },
  ],
  instructions:
    'Rub the rim of the glass with lime. Shake with ice and strain.',
  translations: [],
  hasDetails: true,
};

describe('SurprisePanelComponent', () => {
  let component: SurprisePanelComponent;
  let fixture: ComponentFixture<SurprisePanelComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SurprisePanelComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(SurprisePanelComponent);
    component = fixture.componentInstance;
  });

  it('shows the drink with the recipe page pieces, under a level-2 heading', () => {
    component.state = 'ready';
    component.recipe = margarita;
    component.noun = 'cocktail';
    fixture.detectChanges();
    expect(el().querySelector('h2')!.textContent).toContain('Margarita');
    expect(el().querySelector('h1')).toBeNull();
    expect(
      el().querySelector('app-product-image img')!.getAttribute('alt')
    ).toBe('Margarita');
    expect(el().textContent).toContain('1 1/2 oz');
    expect(el().textContent).toContain('Tequila');
    expect(el().textContent).toContain('Shake with ice and strain.');
    expect(el().querySelector('app-favorite-button')).not.toBeNull();
    expect(el().querySelector('a.text-link')!.getAttribute('href')).toBe(
      '/product-details/11007'
    );
  });

  it('offers another surprise and a labelled close button', () => {
    component.state = 'ready';
    component.recipe = margarita;
    component.noun = 'mocktail';
    fixture.detectChanges();
    let another = 0;
    let closed = 0;
    component.another.subscribe(() => another++);
    component.closed.subscribe(() => closed++);
    const again = el().querySelector<HTMLButtonElement>('.again')!;
    expect(again.textContent).toContain('Another mocktail');
    again.click();
    el()
      .querySelector<HTMLButtonElement>('[aria-label="Close the surprise"]')!
      .click();
    expect([another, closed]).toEqual([1, 1]);
  });

  it('shows loading without an "another" button', () => {
    component.state = 'loading';
    fixture.detectChanges();
    expect(el().querySelector('[role="status"]')!.textContent).toContain(
      'Shaking something up'
    );
    expect(el().querySelector('.again')).toBeNull();
  });

  it('reports errors with a retry', () => {
    component.state = 'error';
    fixture.detectChanges();
    let retried = 0;
    component.retry.subscribe(() => retried++);
    const alert = el().querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain("The bar's closed");
    alert.querySelector('button')!.click();
    expect(retried).toBe(1);
  });

  it('explains when nothing is eligible', () => {
    component.state = 'empty';
    component.noun = 'mocktail';
    fixture.detectChanges();
    expect(el().textContent).toContain(
      "We couldn't find a complete mocktail recipe"
    );
  });
});
