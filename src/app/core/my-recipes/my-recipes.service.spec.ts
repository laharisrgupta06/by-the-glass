import {
  TestBed,
  fakeAsync,
  flush,
  flushMicrotasks,
  tick,
} from '@angular/core/testing';

import { AuthDialogService } from '../auth/auth-dialog.service';
import { AppUser } from '../auth/auth.models';
import { AuthProvider } from '../auth/auth-provider';
import { NoticeService } from '../notice/notice.service';
import { MyRecipe, MyRecipeDraft, MyRecipeImage } from './my-recipe.model';
import { MyRecipesRepository } from './my-recipes-repository';
import {
  MyRecipesService,
  SAVE_TIMEOUT_MS,
  photoFailure,
} from './my-recipes.service';

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

/** In memory, keyed by user: like the Firestore listener and its per-user paths. */
class FakeRepository implements MyRecipesRepository {
  byUser = new Map<string, Map<string, MyRecipe>>();
  files = new Set<string>();
  calls: string[] = [];
  failUpload = false;
  failSave = false;
  hangSave = false;
  finishSave?: () => void;
  uploadError: unknown = new Error('storage unavailable');
  private emit?: (recipes: MyRecipe[], fromCache: boolean) => void;
  private watching = '';
  watch(
    userId: string,
    onChange: (recipes: MyRecipe[], fromCache: boolean) => void
  ) {
    this.emit = onChange;
    this.watching = userId;
    this.push();
    return () => (this.emit = undefined);
  }
  private store(userId: string) {
    if (!this.byUser.has(userId)) this.byUser.set(userId, new Map());
    return this.byUser.get(userId)!;
  }
  async create(
    userId: string,
    id: string,
    draft: MyRecipeDraft,
    image: MyRecipeImage | null
  ) {
    this.calls.push(`create ${id}`);
    if (this.hangSave)
      return new Promise<void>(resolve => (this.finishSave = resolve));
    if (this.failSave) throw new Error('offline');
    this.store(userId).set(id, {
      id,
      ...draft,
      image,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.push();
  }
  async update(
    userId: string,
    id: string,
    draft: MyRecipeDraft,
    image?: MyRecipeImage | null
  ) {
    this.calls.push(`update ${id}`);
    const old = this.store(userId).get(id)!;
    this.store(userId).set(id, {
      ...old,
      ...draft,
      image: image === undefined ? old.image : image,
      updatedAt: new Date(),
    });
    this.push();
  }
  async remove(userId: string, id: string) {
    this.calls.push(`remove ${id}`);
    this.store(userId).delete(id);
    this.push();
  }
  async uploadImage(userId: string, recipeId: string) {
    this.calls.push('upload');
    if (this.failUpload) throw this.uploadError;
    const path = `users/${userId}/myRecipes/${recipeId}/photo-${this.files.size}.webp`;
    this.files.add(path);
    return { path, url: `https://storage.test/${path}` };
  }
  async deleteImage(path: string) {
    this.calls.push(`delete-file ${path.split('/').pop()}`);
    this.files.delete(path);
  }
  private push() {
    this.emit?.([...this.store(this.watching).values()], false);
  }
}

const DRAFT: MyRecipeDraft = {
  name: 'Garden Spritz',
  description: 'Bright and herbal.',
  kind: 'cocktail',
  ingredients: [{ name: 'Gin', quantity: '45', unit: 'ml' }],
  steps: ['Build over ice.'],
  glass: '',
  ice: '',
  garnish: '',
};

describe('MyRecipesService', () => {
  let service: MyRecipesService;
  let auth: FakeAuthProvider;
  let repository: FakeRepository;

  beforeEach(() => {
    auth = new FakeAuthProvider();
    repository = new FakeRepository();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthProvider, useValue: auth },
        { provide: MyRecipesRepository, useValue: repository },
      ],
    });
    service = TestBed.inject(MyRecipesService);
    TestBed.flushEffects();
  });

  const signIn = (id = 'user-1') => {
    auth.setUser({ id, email: `${id}@example.com` });
    TestBed.flushEffects();
  };

  it('creates, edits and deletes the signed-in person’s recipes', fakeAsync(() => {
    signIn();
    let id: string | null = null;
    service.save(DRAFT).then(v => (id = v));
    flushMicrotasks();
    expect(id).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(service.recipes().map(r => r.name)).toEqual(['Garden Spritz']);

    service.save({ ...DRAFT, name: 'Garden Spritz No. 2' }, id!);
    flushMicrotasks();
    expect(repository.calls).toEqual([`create ${id}`, `update ${id}`]);
    expect(service.byId(id!)!.name).toBe('Garden Spritz No. 2');

    service.remove(id!);
    flushMicrotasks();
    expect(service.recipes()).toEqual([]);
    flush();
  }));

  it('never saves an incomplete recipe', fakeAsync(() => {
    signIn();
    let id: string | null = 'unset';
    service.save({ ...DRAFT, steps: [] }).then(v => (id = v));
    flushMicrotasks();
    expect(id).toBeNull();
    expect(repository.calls).toEqual([]);
  }));

  it('asks a signed-out visitor to sign in, and saves nothing if they don’t', fakeAsync(() => {
    const dialog = TestBed.inject(AuthDialogService);
    spyOn(dialog, 'open').and.resolveTo(false);
    service.save(DRAFT);
    flushMicrotasks();
    expect(dialog.open).toHaveBeenCalled();
    expect(repository.calls).toEqual([]);
  }));

  it('only edits recipes of the signed-in person; another person’s id makes a new one', fakeAsync(() => {
    signIn('user-1');
    let first: string | null = null;
    service.save(DRAFT).then(v => (first = v));
    flushMicrotasks();
    signIn('user-2');
    expect(service.recipes()).toEqual([]);
    expect(service.byId(first!)).toBeUndefined();
    let second: string | null = null;
    service.save(DRAFT, first!).then(v => (second = v));
    flushMicrotasks();
    expect(second).not.toBe(first);
    expect(repository.byUser.get('user-1')!.size).toBe(1);
    flush();
  }));

  describe('photos', () => {
    const photo = {
      kind: 'set' as const,
      blob: new Blob(['x']),
      contentType: 'image/webp',
    };
    const save = (
      id?: string,
      change: Parameters<MyRecipesService['save']>[2] = { kind: 'keep' }
    ) => {
      let result: string | null = null;
      service.save(DRAFT, id, change).then(v => (result = v));
      flushMicrotasks();
      return result as string | null;
    };

    it('uploads a photo with a new recipe, keeps it through an edit, replaces and removes it', fakeAsync(() => {
      signIn();
      const id = save(undefined, photo)!;
      const first = service.byId(id)!.image!;
      expect(first.path).toBe(`users/user-1/myRecipes/${id}/photo-0.webp`);

      save(id); // an edit that doesn't touch the photo
      expect(service.byId(id)!.image).toEqual(first);

      save(id, photo); // replace
      const second = service.byId(id)!.image!;
      expect(second.path).not.toBe(first.path);
      expect(repository.files.has(first.path)).toBeFalse();

      save(id, { kind: 'remove' });
      expect(service.byId(id)!.image).toBeNull();
      expect(repository.files.size).toBe(0);
      flush();
    }));

    it('saves nothing when the upload fails, so the form keeps everything', fakeAsync(() => {
      signIn();
      repository.failUpload = true;
      expect(save(undefined, photo)).toBeNull();
      expect(repository.calls).toEqual(['upload']);
      expect(service.recipes()).toEqual([]);
      flush();
    }));

    it('cleans up an uploaded photo when the recipe itself can’t be saved', fakeAsync(() => {
      signIn();
      repository.failSave = true;
      expect(save(undefined, photo)).toBeNull();
      expect(repository.files.size).toBe(0);
      flush();
    }));

    it('deletes a recipe’s photo along with the recipe', fakeAsync(() => {
      signIn();
      const id = save(undefined, photo)!;
      service.remove(id);
      flushMicrotasks();
      expect(repository.files.size).toBe(0);
      flush();
    }));
  });

  describe('when saving goes wrong', () => {
    const photo = {
      kind: 'set' as const,
      blob: new Blob(['x']),
      contentType: 'image/webp',
    };

    it('stops waiting on the database after a while, says so, and frees the button', fakeAsync(() => {
      signIn();
      repository.hangSave = true;
      let result: string | null | undefined;
      service.save(DRAFT, undefined, photo).then(v => (result = v));
      flushMicrotasks();
      expect(service.busy()).toBeTrue();
      tick(SAVE_TIMEOUT_MS);
      flushMicrotasks();
      expect(result).toBeNull();
      expect(service.busy()).toBeFalse();
      expect(service.saveError()).toContain('taking too long');
      // The write may still land, so the photo it points to is kept.
      expect(repository.files.size).toBe(1);
    }));

    it('says so when a save it stopped waiting for lands after all', fakeAsync(() => {
      signIn();
      repository.hangSave = true;
      const notice = spyOn(TestBed.inject(NoticeService), 'show');
      service.save(DRAFT, undefined, photo);
      flushMicrotasks();
      tick(SAVE_TIMEOUT_MS);
      flushMicrotasks();
      expect(service.saveError()).toContain('taking too long');
      repository.finishSave!();
      flushMicrotasks();
      expect(service.saveError()).toBe('');
      expect(notice).toHaveBeenCalledWith('Your recipe was saved after all.');
    }));

    it('explains a failed upload, frees the button, and saves nothing', fakeAsync(() => {
      signIn();
      repository.failUpload = true;
      repository.uploadError = { code: 'storage/emulator-unavailable' };
      let result: string | null | undefined;
      service.save(DRAFT, undefined, photo).then(v => (result = v));
      flushMicrotasks();
      expect(result).toBeNull();
      expect(service.busy()).toBeFalse();
      expect(service.saveError()).toContain('npm run emulators');
      expect(repository.calls).toEqual(['upload']);
    }));

    it('clears the last error when trying again', fakeAsync(() => {
      signIn();
      repository.failUpload = true;
      service.save(DRAFT, undefined, photo);
      flushMicrotasks();
      expect(service.saveError()).not.toBe('');
      repository.failUpload = false;
      service.save(DRAFT, undefined, photo);
      flushMicrotasks();
      expect(service.saveError()).toBe('');
      flush();
    }));

    it('updates rather than duplicates when a new recipe’s id was saved after all', fakeAsync(() => {
      signIn();
      const newId = 'AbCdEfGhIjKlMnOpQrSt';
      service.save(DRAFT, undefined, { kind: 'keep' }, newId);
      flushMicrotasks();
      service.save(
        { ...DRAFT, name: 'Again' },
        undefined,
        { kind: 'keep' },
        newId
      );
      flushMicrotasks();
      expect(repository.calls).toEqual([`create ${newId}`, `update ${newId}`]);
      expect(service.recipes().length).toBe(1);
      flush();
    }));

    it('gives an actionable message for each kind of upload failure', () => {
      expect(photoFailure({ code: 'storage/unauthorized' })).toContain(
        'refused'
      );
      expect(photoFailure({ code: 'storage/retry-limit-exceeded' })).toContain(
        'took too long'
      );
      expect(photoFailure({ code: 'storage/quota-exceeded' })).toContain(
        'Remove the photo'
      );
      expect(photoFailure(new Error('?'))).toContain(
        'Couldn’t upload the photo'
      );
      for (const code of ['storage/unauthorized', 'x'])
        expect(photoFailure({ code })).toContain('still here');
    });
  });
});
