import {
  TestBed,
  fakeAsync,
  flush,
  flushMicrotasks,
} from '@angular/core/testing';

import { AiRecipe, aiRecipeId } from '../ai/ai-recipe';
import { AuthDialogService } from '../auth/auth-dialog.service';
import { AppUser } from '../auth/auth.models';
import { AuthProvider } from '../auth/auth-provider';
import { FavoritesRepository } from '../favorites/favorites-repository';
import { SavedRecipe, readSavedRecipe } from './saved-recipe.model';
import { SavedRecipesRepository } from './saved-recipes-repository';
import { SavedRecipesService } from './saved-recipes.service';

class FakeAuthProvider implements AuthProvider {
  configured = true;
  private emit?: (user: AppUser | null) => void;
  watchUser(onChange: (user: AppUser | null) => void) {
    this.emit = onChange;
    onChange(null);
    return () => undefined;
  }
  setUser(user: AppUser | null) {
    this.emit?.(user);
  }
  signUp = () => Promise.resolve();
  signIn = () => Promise.resolve();
  signOut = () => Promise.resolve();
  updateDisplayName = () => Promise.resolve();
}

/** In memory, behaving like the Firestore listener (and its create-only rule). */
class FakeRepository implements SavedRecipesRepository {
  stored = new Map<string, Omit<SavedRecipe, 'createdAt'>>();
  adds = 0;
  private emit?: (recipes: SavedRecipe[], fromCache: boolean) => void;
  watch(
    userId: string,
    onChange: (recipes: SavedRecipe[], fromCache: boolean) => void
  ) {
    this.emit = onChange;
    this.push();
    return () => (this.emit = undefined);
  }
  async add(userId: string, recipe: Omit<SavedRecipe, 'createdAt'>) {
    this.adds++;
    if (this.stored.has(recipe.id))
      throw new Error('permission-denied: no updates');
    this.stored.set(recipe.id, recipe);
    this.push();
  }
  async remove(userId: string, id: string) {
    this.stored.delete(id);
    this.push();
  }
  private push() {
    this.emit?.(
      [...this.stored.values()].map(r => ({ ...r, createdAt: new Date() })),
      false
    );
  }
}

const RECIPE: AiRecipe = {
  name: 'Jelly Lime Cooler',
  kind: 'mocktail',
  description: 'Mogu Mogu lengthened with lime and soda.',
  ingredients: [
    { name: 'Mogu Mogu', amount: '320 ml', origin: 'given', optional: false },
    { name: 'Soda water', amount: 'Top up', origin: 'extra', optional: true },
  ],
  steps: ['Fill a glass with ice.', 'Add Mogu Mogu.', 'Top with soda.'],
  glass: 'Highball',
  ice: 'Over cubed ice',
  garnish: '',
  serving: 'With a wide straw.',
};

describe('SavedRecipesService', () => {
  let service: SavedRecipesService;
  let auth: FakeAuthProvider;
  let repository: FakeRepository;

  beforeEach(() => {
    auth = new FakeAuthProvider();
    repository = new FakeRepository();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthProvider, useValue: auth },
        { provide: SavedRecipesRepository, useValue: repository },
        { provide: FavoritesRepository, useValue: {} },
      ],
    });
    service = TestBed.inject(SavedRecipesService);
    TestBed.flushEffects();
  });

  const signIn = () => {
    auth.setUser({ id: 'user-1', email: 'a@example.com' });
    TestBed.flushEffects();
  };

  it('saves the complete recipe, marked AI-curated, under a content id', fakeAsync(() => {
    signIn();
    service.save(RECIPE, ['Mogu Mogu']);
    flushMicrotasks();
    const stored = repository.stored.get(aiRecipeId(RECIPE))!;
    expect(stored.origin).toBe('ai-curated');
    expect(stored.recipe).toEqual(RECIPE);
    expect(stored.basedOn).toEqual(['Mogu Mogu']);
    expect(service.isSaved(RECIPE)).toBeTrue();
    expect(service.recipes()[0].recipe.steps).toEqual(RECIPE.steps);
    flush(); // the "saved" notice's timer
  }));

  it('never saves the same recipe twice', fakeAsync(() => {
    signIn();
    service.save(RECIPE, ['Mogu Mogu']);
    flushMicrotasks();
    service.save({ ...RECIPE }, ['Mogu Mogu']);
    flushMicrotasks();
    expect(repository.adds).toBe(1);
    expect(repository.stored.size).toBe(1);
    flush();
  }));

  it('asks a signed-out visitor to sign in first, and saves nothing if they don’t', fakeAsync(() => {
    const dialog = TestBed.inject(AuthDialogService);
    spyOn(dialog, 'open').and.resolveTo(false);
    service.save(RECIPE, ['Mogu Mogu']);
    flushMicrotasks();
    expect(dialog.open).toHaveBeenCalledWith(
      jasmine.objectContaining({ mode: 'sign-in' })
    );
    expect(repository.stored.size).toBe(0);
  }));

  it('only reopens stored recipes that still pass the checks', () => {
    const data = {
      origin: 'ai-curated',
      basedOn: ['Mogu Mogu'],
      recipe: RECIPE,
      createdAt: { toDate: () => new Date(0) },
    };
    expect(readSavedRecipe('ai-1', data)?.recipe).toEqual(RECIPE);
    expect(readSavedRecipe('ai-1', { ...data, origin: 'other' })).toBeNull();
    expect(
      readSavedRecipe('ai-1', {
        ...data,
        recipe: { ...RECIPE, serving: 'Only $5' },
      })
    ).toBeNull();
  });
});
