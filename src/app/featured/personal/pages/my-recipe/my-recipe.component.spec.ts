import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  flushMicrotasks,
} from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  ActivatedRoute,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from 'src/app/core/auth/auth.service';
import { MyRecipe } from 'src/app/core/my-recipes/my-recipe.model';
import { MyRecipesService } from 'src/app/core/my-recipes/my-recipes.service';
import { MyRecipeComponent } from './my-recipe.component';

const SAVED: MyRecipe = {
  id: 'AbCdEfGhIjKlMnOpQrSt',
  name: 'Garden Spritz',
  description: 'Bright and herbal.',
  kind: 'cocktail',
  ingredients: [{ name: 'Gin', quantity: '45', unit: 'ml' }],
  steps: ['Build over ice.', 'Top with soda.'],
  glass: 'Highball',
  ice: 'Built over ice',
  garnish: '',
  image: null,
  createdAt: null,
  updatedAt: null,
};

describe('MyRecipeComponent', () => {
  let fixture: ComponentFixture<MyRecipeComponent>;
  let remove: jasmine.Spy;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');

  function setUp(id: string, authStatus = 'signed-in') {
    remove = jasmine.createSpy('remove').and.resolveTo(true);
    TestBed.configureTestingModule({
      imports: [MyRecipeComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id })) },
        },
        { provide: AuthService, useValue: { status: signal(authStatus) } },
        {
          provide: MyRecipesService,
          useValue: {
            status: signal('ready'),
            busy: signal(false),
            byId: (i: string) => (i === SAVED.id ? SAVED : undefined),
            remove,
            reload: () => undefined,
          },
        },
      ],
    });
    fixture = TestBed.createComponent(MyRecipeComponent);
    fixture.detectChanges();
  }

  it('opens your recipe in the usual recipe layout, with Edit', () => {
    setUp(SAVED.id);
    expect(text()).toContain('Garden Spritz');
    expect(text()).toContain('Bright and herbal.');
    expect(text()).toContain('45 ml Gin');
    expect(text()).toContain('Top with soda.');
    expect(text()).toContain('Built over ice');
    expect(text()).toContain('Your recipe, private to you.');
    expect(el().querySelector('a.primary')!.getAttribute('href')).toBe(
      `/personal/recipes/${SAVED.id}/edit`
    );
  });

  it('deletes only after a second, explicit confirmation', fakeAsync(() => {
    setUp(SAVED.id);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    el().querySelector<HTMLButtonElement>('.actions .secondary')!.click();
    fixture.detectChanges();
    expect(remove).not.toHaveBeenCalled();
    expect(text()).toContain("Delete this recipe? This can't be undone.");
    el().querySelector<HTMLButtonElement>('.danger')!.click();
    flushMicrotasks();
    expect(remove).toHaveBeenCalledWith(SAVED.id);
    expect(router.navigate).toHaveBeenCalledWith(['/personal']);
  }));

  it('shows nothing for a recipe that isn’t yours', () => {
    setUp('SomeoneElsesRecipe01');
    expect(text()).toContain("We couldn't find this recipe among yours.");
    expect(text()).not.toContain('Edit');
  });

  it('asks a signed-out visitor to sign in', () => {
    setUp(SAVED.id, 'signed-out');
    expect(text()).toContain('Your recipes are private.');
    expect(text()).not.toContain('Garden Spritz');
  });
});
