import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  ActivatedRoute,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from 'src/app/core/auth/auth.service';
import { SavedRecipesService } from 'src/app/core/saved-recipes/saved-recipes.service';
import { SavedRecipeComponent } from './saved-recipe.component';

const SAVED = {
  id: 'ai-0123456789abcdef',
  origin: 'ai-curated',
  basedOn: ['Mogu Mogu'],
  createdAt: null,
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

describe('SavedRecipeComponent', () => {
  it('opens a saved AI recipe in full, and can remove it', fakeAsync(() => {
    const remove = jasmine.createSpy('remove').and.resolveTo(undefined);
    TestBed.configureTestingModule({
      imports: [SavedRecipeComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: SAVED.id })) },
        },
        { provide: AuthService, useValue: { status: signal('signed-in') } },
        {
          provide: SavedRecipesService,
          useValue: {
            status: signal('ready'),
            recipes: signal([SAVED]),
            remove,
            reload: () => undefined,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(SavedRecipeComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent!.replace(
      /\s+/g,
      ' '
    );
    expect(text).toContain('Jelly Lime Cooler');
    expect(text).toContain('320 ml');
    expect(text).toContain('Add Mogu Mogu.');
    expect(text).toContain('AI-curated');
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.secondary')!
      .click();
    flushMicrotasks();
    expect(remove).toHaveBeenCalled();
  }));
});
