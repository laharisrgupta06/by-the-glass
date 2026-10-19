import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Recipe } from '../../../products/models/recipe.model';
import { CabinetMatch } from '../../utils/cabinet';
import {
  ALMOST_SHOWN,
  CabinetResultsComponent,
} from './cabinet-results.component';

const drink = (n: number): Recipe => ({
  id: String(n),
  source: 'cocktaildb',
  credit: 'TheCocktailDB',
  name: `Drink ${n}`,
  kind: 'mocktail',
  ingredients: [],
  translations: [],
  hasDetails: true,
});
const match = (n: number, missing: string[]): CabinetMatch => ({
  recipe: drink(n),
  missing: missing.map(name => ({ key: name.toLowerCase(), name })),
  covered: 1,
  stands: [],
});

describe('CabinetResultsComponent', () => {
  let fixture: ComponentFixture<CabinetResultsComponent>;
  let component: CabinetResultsComponent;
  const text = () =>
    (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CabinetResultsComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(CabinetResultsComponent);
    component = fixture.componentInstance;
    component.status = 'ready';
  });

  it('lists every missing ingredient on a near match', () => {
    component.results = {
      ready: [],
      almost: [match(1, ['Strawberries', 'Apple juice'])],
      checked: 10,
    };
    fixture.detectChanges();
    expect(text()).toContain('Almost there: missing ingredients');
    expect(text()).toContain('Missing: Strawberries and Apple juice');
  });

  it('shows the closest near matches first, and all on request', () => {
    const almost = Array.from({ length: ALMOST_SHOWN + 5 }, (_, i) =>
      match(i, ['Lime'])
    );
    component.results = { ready: [], almost, checked: 100 };
    fixture.detectChanges();
    const cards = () =>
      fixture.nativeElement.querySelectorAll(
        '[aria-labelledby=almost-title] app-product-card'
      ).length;
    expect(cards()).toBe(ALMOST_SHOWN);
    const showAll = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button')
    ).find(b => b.textContent?.includes(`Show all ${almost.length}`))!;
    showAll.click();
    fixture.detectChanges();
    expect(cards()).toBe(almost.length);
  });

  it('says honestly when part of the catalogue did not load', () => {
    component.results = { ready: [], almost: [], checked: 0 };
    component.gaps = {
      failedLetters: ['B', 'C'],
      failedLists: false,
      missingDetails: 3,
    };
    fixture.detectChanges();
    expect(text()).toContain(
      "We couldn't load everything just now (ingredients for 3 drinks and 2 letters of the catalogue), so there may be more matches."
    );
  });

  it('names the person’s own ingredients when nothing matches', () => {
    component.results = { ready: [], almost: [], checked: 400 };
    component.own = ['Mogu Mogu'];
    fixture.detectChanges();
    expect(text()).toContain('None of our recipes use “Mogu Mogu” yet.');
    expect(text()).toContain('The AI Bartender can create a drink with it.');
  });
});
