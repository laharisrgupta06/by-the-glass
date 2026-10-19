import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { SavedRecipe } from 'src/app/core/saved-recipes/saved-recipe.model';
import { SavedRecipesService } from 'src/app/core/saved-recipes/saved-recipes.service';
import { SavedRecipesSectionComponent } from './saved-recipes-section.component';

const SAVED: SavedRecipe = {
  id: 'ai-0123456789abcdef',
  origin: 'ai-curated',
  basedOn: ['Mogu Mogu'],
  createdAt: new Date(),
  recipe: {
    name: 'Jelly Lime Cooler',
    kind: 'mocktail',
    description: 'Mogu Mogu with lime and soda.',
    ingredients: [
      { name: 'Mogu Mogu', amount: '320 ml', origin: 'given', optional: false },
    ],
    steps: ['Fill a glass with ice.', 'Add Mogu Mogu.'],
    glass: 'Highball',
    ice: 'Over cubed ice',
    garnish: '',
    serving: 'With a wide straw.',
  },
};

describe('SavedRecipesSectionComponent', () => {
  let fixture: ComponentFixture<SavedRecipesSectionComponent>;
  const recipes = signal<SavedRecipe[]>([SAVED]);
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    recipes.set([SAVED]);
    TestBed.configureTestingModule({
      imports: [SavedRecipesSectionComponent],
      providers: [
        provideRouter([]),
        {
          provide: SavedRecipesService,
          useValue: {
            status: signal('ready'),
            recipes,
            reload: () => undefined,
          },
        },
      ],
    });
    fixture = TestBed.createComponent(SavedRecipesSectionComponent);
    fixture.detectChanges();
  });

  it('shows saved AI recipes as cards, labelled AI-curated, each opening the full recipe', () => {
    const card = el().querySelector('app-product-card')!;
    expect(card.querySelector('.name')!.textContent).toContain(
      'Jelly Lime Cooler'
    );
    expect(card.querySelector('.detail')!.textContent).toContain(
      'AI-curated · Mocktail'
    );
    expect(card.querySelector('.description')!.textContent).toContain(
      'Mogu Mogu with lime and soda.'
    );
    expect(card.querySelector('a')!.getAttribute('href')).toBe(
      `/personal/saved-recipes/${SAVED.id}`
    );
  });

  it('has an empty state of its own', () => {
    recipes.set([]);
    fixture.detectChanges();
    expect(el().textContent).toContain('No saved AI recipes yet.');
  });
});
