import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';

import { AuthDialogService } from '../auth/auth-dialog.service';
import { AppUser } from '../auth/auth.models';
import { AuthProvider } from '../auth/auth-provider';
import { NoticeService } from '../notice/notice.service';
import { FavoriteDrink, FavoriteRecord, favoriteKey } from './favorite.model';
import { FavoritesRepository } from './favorites-repository';
import { FavoritesService } from './favorites.service';

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

/** In-memory stand-in that behaves like the live Firestore listener. */
class FakeRepository implements FavoritesRepository {
  stored = new Map<string, FavoriteRecord>();
  fail = false;
  offline = false;
  private emit?: (favorites: FavoriteRecord[], fromCache: boolean) => void;
  watch(
    userId: string,
    onChange: (favorites: FavoriteRecord[], fromCache: boolean) => void
  ) {
    this.emit = onChange;
    onChange(this.offline ? [] : [...this.stored.values()], this.offline);
    return () => (this.emit = undefined);
  }
  async add(userId: string, drink: FavoriteDrink) {
    if (this.fail) throw new Error('denied');
    this.stored.set(drink.id, {
      userId,
      source: drink.source,
      drinkId: drink.id,
      name: drink.name,
      createdAt: new Date(),
    });
    this.emit?.([...this.stored.values()], false);
  }
  async remove(userId: string, drink: FavoriteDrink) {
    if (this.fail) throw new Error('denied');
    this.stored.delete(drink.id);
    this.emit?.([...this.stored.values()], false);
  }
}

describe('FavoritesService', () => {
  const margarita: FavoriteDrink = {
    source: 'cocktaildb',
    id: '11007',
    name: 'Margarita',
  };
  let service: FavoritesService;
  let auth: FakeAuthProvider;
  let repository: FakeRepository;
  let dialog: AuthDialogService;
  let notice: NoticeService;

  beforeEach(() => {
    auth = new FakeAuthProvider();
    repository = new FakeRepository();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthProvider, useValue: auth },
        { provide: FavoritesRepository, useValue: repository },
      ],
    });
    service = TestBed.inject(FavoritesService);
    dialog = TestBed.inject(AuthDialogService);
    notice = TestBed.inject(NoticeService);
    TestBed.flushEffects();
  });

  const signIn = () => {
    auth.setUser({ id: 'user-1', email: 'a@example.com' });
    TestBed.flushEffects();
  };

  it('asks a signed-out visitor to sign in and saves nothing', fakeAsync(() => {
    spyOn(repository, 'add').and.callThrough();
    service.toggle(margarita);
    flushMicrotasks();
    expect(dialog.request()?.reason).toContain('Margarita');
    dialog.close(false);
    flushMicrotasks();
    expect(repository.add).not.toHaveBeenCalled();
    expect(service.isFavorite(margarita)).toBeFalse();
  }));

  it('saves and removes for a signed-in user', fakeAsync(() => {
    signIn();
    service.toggle(margarita);
    expect(service.isFavorite(margarita)).toBeTrue();
    flushMicrotasks();
    expect(repository.stored.has('11007')).toBeTrue();

    service.toggle(margarita);
    flushMicrotasks();
    expect(service.isFavorite(margarita)).toBeFalse();
    expect(repository.stored.has('11007')).toBeFalse();
  }));

  it('keeps existing TheCocktailDB favourites working alongside menu drinks', fakeAsync(() => {
    // A favourite saved before the venue menu existed.
    repository.stored.set('11007', {
      userId: 'user-1',
      source: 'cocktaildb',
      drinkId: '11007',
      name: 'Margarita',
      createdAt: new Date(2026, 0, 1),
    });
    signIn();
    expect(service.isFavorite(margarita)).toBeTrue();

    const lassi: FavoriteDrink = {
      source: 'venue-menu',
      id: 'bg-menu-test-saffron-lassi',
      name: 'Test Saffron Lassi',
      kind: 'mocktail',
    };
    spyOn(repository, 'add').and.callThrough();
    service.toggle(lassi);
    flushMicrotasks();
    expect(repository.add).toHaveBeenCalledWith('user-1', lassi);
    expect(service.isFavorite(lassi)).toBeTrue();
    expect(service.isFavorite(margarita)).toBeTrue();
    expect(
      service.favorites().map(f => favoriteKey(f.source, f.drinkId))
    ).toEqual(
      jasmine.arrayWithExactContents([
        'cocktaildb_11007',
        'venue-menu_bg-menu-test-saffron-lassi',
      ])
    );

    // Renaming the drink doesn't change its id, so it's still the saved one.
    const renamed: FavoriteDrink = {
      ...lassi,
      name: 'Test Saffron Lassi (Classic)',
    };
    expect(service.isFavorite(renamed)).toBeTrue();
  }));

  it('rolls back and explains when a save fails', fakeAsync(() => {
    signIn();
    repository.fail = true;
    service.toggle(margarita);
    flushMicrotasks();
    expect(service.isFavorite(margarita)).toBeFalse();
    expect(notice.message()).toContain('Couldn’t save Margarita');
    notice.dismiss();
  }));

  it('finishes the save after signing in from the heart', fakeAsync(() => {
    service.toggle(margarita);
    flushMicrotasks();
    signIn();
    dialog.close(true);
    flushMicrotasks();
    TestBed.flushEffects();
    flushMicrotasks();
    expect(repository.stored.has('11007')).toBeTrue();
  }));

  it('forgets favorites on sign-out', fakeAsync(() => {
    signIn();
    service.toggle(margarita);
    flushMicrotasks();
    auth.setUser(null);
    TestBed.flushEffects();
    expect(service.isFavorite(margarita)).toBeFalse();
    expect(service.status()).toBe('idle');
  }));

  it('reports a load failure instead of an empty cabinet when offline', () => {
    repository.offline = true;
    signIn();
    expect(service.status()).toBe('error');
  });
});
