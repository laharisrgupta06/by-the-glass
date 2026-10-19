import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';

import { MyRecipe } from 'src/app/core/my-recipes/my-recipe.model';
import { MyRecipesService } from 'src/app/core/my-recipes/my-recipes.service';
import { MyRecipesSectionComponent } from './my-recipes-section.component';

const RECIPE: MyRecipe = {
  id: 'AbCdEfGhIjKlMnOpQrSt',
  name: 'Garden Spritz',
  description: 'Bright and herbal.',
  kind: 'cocktail',
  ingredients: [
    { name: 'Gin', quantity: '45', unit: 'ml' },
    { name: 'Soda water', quantity: '', unit: 'top up' },
  ],
  steps: ['Build over ice.'],
  glass: '',
  ice: '',
  garnish: '',
  image: {
    path: 'users/u/myRecipes/x/photo.webp',
    url: 'https://storage.test/photo.webp',
  },
  createdAt: null,
  updatedAt: null,
};

describe('MyRecipesSectionComponent', () => {
  let fixture: ComponentFixture<MyRecipesSectionComponent>;
  const status = signal('ready');
  const recipes = signal<MyRecipe[]>([]);
  const remove = jasmine.createSpy('remove').and.resolveTo(true);
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');

  beforeEach(() => {
    status.set('ready');
    recipes.set([]);
    remove.calls.reset();
    TestBed.configureTestingModule({
      imports: [MyRecipesSectionComponent],
      providers: [
        provideRouter([]),
        {
          provide: MyRecipesService,
          useValue: {
            status,
            recipes,
            remove,
            busy: signal(false),
            reload: () => undefined,
          },
        },
      ],
    });
    fixture = TestBed.createComponent(MyRecipesSectionComponent);
    fixture.detectChanges();
  });

  it('always offers to create a recipe, and has a friendly empty state', () => {
    const link = el().querySelector('a.create')!;
    expect(link.textContent).toContain('Create a recipe');
    expect(link.getAttribute('href')).toBe('/personal/recipes/new');
    expect(text()).toContain("You haven't created a recipe yet.");
  });

  it('shows each recipe as a drink card that opens its own page', () => {
    recipes.set([RECIPE]);
    fixture.detectChanges();
    const card = el().querySelector('app-product-card')!;
    expect(card.querySelector('a.drink-card')!.getAttribute('href')).toBe(
      `/personal/recipes/${RECIPE.id}`
    );
    expect(card.querySelector('.name')!.textContent).toContain('Garden Spritz');
    expect(card.querySelector('.detail')!.textContent).toContain(
      'Cocktail · 2 ingredients'
    );
    expect(card.querySelector('.description')!.textContent).toContain(
      'Bright and herbal.'
    );
    expect(card.querySelector('img')!.getAttribute('src')).toBe(
      RECIPE.image!.url
    );
    // Your own recipe isn't a favourite.
    expect(card.querySelector('app-favorite-button')).toBeNull();
  });

  it('shows a placeholder when a recipe has no photo', () => {
    recipes.set([{ ...RECIPE, image: null }]);
    fixture.detectChanges();
    expect(el().querySelector('.no-photo')!.textContent).toContain('No photo');
  });

  it('keeps Edit and Delete apart from the card link, and deletes only when confirmed', () => {
    recipes.set([RECIPE]);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    const actions = el().querySelector('.card-actions')!;
    // Outside the card's link, so clicking them never opens the recipe.
    expect(actions.closest('a.drink-card')).toBeNull();
    expect(actions.querySelector('a')!.getAttribute('href')).toBe(
      `/personal/recipes/${RECIPE.id}/edit`
    );
    actions.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    expect(remove).not.toHaveBeenCalled();
    expect(text()).toContain('Delete for good?');
    el().querySelector<HTMLButtonElement>('.card-actions .danger')!.click();
    expect(remove).toHaveBeenCalledWith(RECIPE.id);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('says so when recipes can’t be opened', () => {
    status.set('error');
    fixture.detectChanges();
    expect(text()).toContain("We couldn't open your recipes.");
  });
});
