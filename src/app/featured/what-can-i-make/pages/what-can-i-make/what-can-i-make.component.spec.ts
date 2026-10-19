import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';

import { API_URL, ApiURL } from '../../../products/config/product.config';
import {
  CocktailDbSource,
  fromCocktailDb,
} from '../../../products/data/cocktaildb.source';
import { CuratedSource } from '../../../products/data/curated.source';
import { DrinkRepository } from '../../../products/data/drink.repository';
import { ProductService } from '../../../products/services/product.service';
import { patchState } from '@ngrx/signals';
import { APPLE_BANANA_DRINKS } from '../../testing/apple-banana.fixture';
import { CabinetStore } from '../../store/cabinet.store';
import { WhatCanIMakeComponent } from './what-can-i-make.component';

describe('WhatCanIMakeComponent', () => {
  let component: WhatCanIMakeComponent;
  let fixture: ComponentFixture<WhatCanIMakeComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WhatCanIMakeComponent, NoopAnimationsModule],
      providers: [
        CabinetStore,
        ProductService,
        DrinkRepository,
        CocktailDbSource,
        CuratedSource,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', component: WhatCanIMakeComponent }]),
        { provide: API_URL, useValue: ApiURL },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(WhatCanIMakeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('asks for an ingredient before looking', () => {
    component.find();
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert.textContent).toContain('Add at least one ingredient');
  });

  it('keeps the cabinet in the URL without duplicates', async () => {
    component.addIngredient('gin');
    await fixture.whenStable();
    component.addIngredient('Gin');
    await fixture.whenStable();
    component.addIngredient('lime');
    await fixture.whenStable();
    expect(router.url).toBe('/?i=gin&i=lime');

    component.removeIngredient('gin');
    await fixture.whenStable();
    expect(router.url).toBe('/?i=lime');
  });

  it('keeps type and taste in the URL', async () => {
    component.setType('mocktail');
    await fixture.whenStable();
    component.toggleTaste('sour');
    await fixture.whenStable();
    expect(router.url).toBe('/?type=mocktail&taste=sour');
    component.widen();
    await fixture.whenStable();
    expect(router.url).toBe('/');
  });

  it('labels Surprise me with the chosen drink type', async () => {
    const button = () =>
      fixture.nativeElement.querySelector(
        'button.surprise'
      ) as HTMLButtonElement;
    expect(button().textContent).toContain('Surprise me with a drink');
    component.setType('mocktail');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(button().textContent).toContain('Surprise me with a mocktail');
  });

  it('shows a loading surprise while the drinks list is still on its way', () => {
    component.surprise();
    fixture.detectChanges();
    expect(component.surpriseState()).toBe('loading');
    expect(
      fixture.nativeElement.querySelector('app-surprise-panel')
    ).not.toBeNull();
    component.closeSurprise();
    fixture.detectChanges();
    expect(component.surpriseState()).toBeNull();
  });

  describe('your own ingredients and the AI Bartender', () => {
    const ready = () => {
      patchState(TestBed.inject(CabinetStore) as never, {
        status: 'ready',
        recipes: APPLE_BANANA_DRINKS.map(fromCocktailDb),
        gaps: { failedLetters: [], failedLists: false, missingDetails: 0 },
      });
      fixture.detectChanges();
    };
    const text = () =>
      (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

    it('keeps Mogu Mogu in the cabinet as typed, never swapped for something similar', async () => {
      component.addOwnIngredient('Mogu Mogu');
      await fixture.whenStable();
      expect(router.url).toBe('/?i=Mogu%20Mogu');
      ready();
      expect(component.have()).toEqual(['mogu mogu']);
      expect(component.haveLabels()).toEqual(['Mogu Mogu']);
      expect(component.ownLabels()).toEqual(['Mogu Mogu']);
    });

    it('keeps the AI Bartender available when no catalogue recipe matches', async () => {
      component.addOwnIngredient('Mogu Mogu');
      await fixture.whenStable();
      ready();
      component.find();
      fixture.detectChanges();
      expect(text()).toContain('None of our recipes use “Mogu Mogu” yet.');
      expect(text()).toContain('Ask AI Bartender to Create a Drink');
      const panel = fixture.nativeElement.querySelector('app-bartender-panel');
      expect(panel).not.toBeNull();
    });

    it('sends the whole cabinet, our ingredients and the person’s own, to the AI Bartender', async () => {
      component.addOwnIngredient('Mogu Mogu');
      await fixture.whenStable();
      ready();
      component.addIngredient('banana');
      await fixture.whenStable();
      fixture.detectChanges();
      expect(router.url).toBe('/?i=Mogu%20Mogu&i=banana');
      expect(component.haveLabels()).toEqual(['Mogu Mogu', 'Banana']);
    });

    it('finds the apple and banana drinks, with what is missing', async () => {
      await router.navigateByUrl('/?i=apple&i=banana');
      ready();
      component.find();
      fixture.detectChanges();
      expect(text()).toContain('Almost there: missing ingredients');
      expect(text()).toContain('Apple Berry Smoothie');
      expect(text()).toContain('Missing: Berries');
      expect(text()).toContain('Banana Strawberry Shake Daiquiri');
      expect(text()).toContain('Missing: Strawberries and Apple juice');
    });
  });

  it('shows the pouring animation in the page header, where it can always be seen', () => {
    const header = fixture.nativeElement.querySelector('header.intro');
    expect(header.querySelector('app-pour-animation')).not.toBeNull();
  });
});
