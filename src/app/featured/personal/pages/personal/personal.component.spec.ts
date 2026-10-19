import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  flush,
  flushMicrotasks,
} from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { AuthService } from 'src/app/core/auth/auth.service';
import { AppUser } from 'src/app/core/auth/auth.models';
import { FavoritesService } from 'src/app/core/favorites/favorites.service';
import { MyRecipesService } from 'src/app/core/my-recipes/my-recipes.service';
import { SavedRecipesService } from 'src/app/core/saved-recipes/saved-recipes.service';
import { PersonalComponent } from './personal.component';

describe('PersonalComponent', () => {
  let fixture: ComponentFixture<PersonalComponent>;
  const status = signal('signed-in');
  const user = signal<AppUser | null>(null);
  const updateDisplayName = jasmine.createSpy('updateDisplayName');
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');

  function setUp(state: string, account: AppUser | null) {
    status.set(state);
    updateDisplayName.calls.reset();
    updateDisplayName.and.resolveTo(null);
    user.set(account);
    const empty = { status: signal('ready'), reload: () => undefined };
    TestBed.configureTestingModule({
      imports: [PersonalComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            status,
            user,
            signOut: () => Promise.resolve(null),
            updateDisplayName,
          },
        },
        {
          provide: FavoritesService,
          useValue: {
            ...empty,
            favorites: signal([
              {
                userId: 'u1',
                source: 'cocktaildb',
                drinkId: '11007',
                name: 'Margarita',
                createdAt: null,
              },
              {
                userId: 'u1',
                source: 'cocktaildb',
                drinkId: '11000',
                name: 'Mojito',
                createdAt: null,
              },
            ]),
            isFavorite: () => true,
            isBusy: () => false,
            toggle: () => Promise.resolve(),
          },
        },
        {
          provide: SavedRecipesService,
          useValue: { ...empty, recipes: signal([]) },
        },
        {
          provide: MyRecipesService,
          useValue: {
            ...empty,
            recipes: signal([
              {
                id: 'AbCdEfGhIjKlMnOpQrSt',
                name: 'Garden Spritz',
                description: '',
                kind: 'cocktail',
                ingredients: [{ name: 'Gin', quantity: '45', unit: 'ml' }],
                steps: ['Build over ice.'],
                glass: '',
                ice: '',
                garnish: '',
                image: null,
                createdAt: null,
                updatedAt: null,
              },
            ]),
            busy: signal(false),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(PersonalComponent);
    fixture.detectChanges();
  }

  it('shows the account’s real name and initials when it has one', () => {
    setUp('signed-in', {
      id: 'u1',
      email: 'asha@example.com',
      displayName: 'Asha Rao',
    });
    expect(el().querySelector('h1')!.textContent).toContain('Asha Rao');
    expect(el().querySelector('.avatar')!.textContent!.trim()).toBe('AR');
    expect(text()).toContain('asha@example.com');
  });

  it('falls back plainly when there is no name, inventing nothing', () => {
    setUp('signed-in', {
      id: 'u1',
      email: 'asha@example.com',
      displayName: null,
    });
    expect(el().querySelector('h1')!.textContent).toContain('Your profile');
    expect(el().querySelector('.avatar')!.textContent!.trim()).toBe('A');
  });

  it('keeps Saved drinks, Saved AI recipes and My recipes apart; the header has Edit profile and Sign out', () => {
    setUp('signed-in', { id: 'u1', email: 'a@example.com' });
    const headings = Array.from(el().querySelectorAll('h2:not(.name)')).map(h =>
      h.textContent!.trim()
    );
    expect(headings).toEqual([
      'Saved drinks',
      'Saved AI recipes',
      'My recipes',
    ]);
    // Creating a recipe lives in My recipes, not the profile header.
    expect(
      el().querySelector('.profile a[href="/personal/recipes/new"]')
    ).toBeNull();
    expect(
      el().querySelector(
        'app-my-recipes-section a[href="/personal/recipes/new"]'
      )
    ).not.toBeNull();
    const buttons = Array.from(el().querySelectorAll('.profile button')).map(
      b => b.textContent!.trim()
    );
    expect(buttons).toEqual(['Edit profile', 'Sign out']);
    expect(text()).toContain('2 saved drinks');
    expect(text()).toContain('1 recipe of your own');
  });

  it('welcomes a signed-out visitor with sign-in actions and what they’ll find', () => {
    setUp('signed-out', null);
    expect(text()).toContain('Sign in');
    expect(text()).toContain('Create an account');
    expect(text()).toContain('My recipes');
    expect(el().querySelector('app-my-recipes-section')).toBeNull();
  });

  describe('Edit profile', () => {
    const button = (label: string) =>
      Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find(
        b => b.textContent!.trim() === label
      )!;
    const input = () => el().querySelector<HTMLInputElement>('#display-name')!;
    const open = () => {
      button('Edit profile').click();
      fixture.detectChanges();
    };

    it('starts with the current name and saves the new one', fakeAsync(() => {
      setUp('signed-in', {
        id: 'u1',
        email: 'a@example.com',
        displayName: 'Asha',
      });
      open();
      expect(input().value).toBe('Asha');
      input().value = 'Asha Rao';
      input().dispatchEvent(new Event('input'));
      el()
        .querySelector<HTMLFormElement>('.name-form')!
        .dispatchEvent(new Event('submit'));
      fixture.detectChanges();
      expect(button('Saving…').disabled).toBeTrue();
      flushMicrotasks();
      fixture.detectChanges();
      expect(updateDisplayName).toHaveBeenCalledWith('Asha Rao');
      expect(el().querySelector('.name-form')).toBeNull();
      flush();
    }));

    it('shows why a name wasn’t saved and keeps what was typed', fakeAsync(() => {
      setUp('signed-in', {
        id: 'u1',
        email: 'a@example.com',
        displayName: null,
      });
      updateDisplayName.and.resolveTo(
        'Enter a name, or cancel to keep things as they are.'
      );
      open();
      expect(input().value).toBe('');
      el()
        .querySelector<HTMLFormElement>('.name-form')!
        .dispatchEvent(new Event('submit'));
      flushMicrotasks();
      fixture.detectChanges();
      expect(el().querySelector('.name-error')!.textContent).toContain(
        'Enter a name'
      );
      expect(input().getAttribute('aria-invalid')).toBe('true');
      expect(el().querySelector('.name-form')).not.toBeNull();
      flush();
    }));

    it('cancels without saving', fakeAsync(() => {
      setUp('signed-in', {
        id: 'u1',
        email: 'a@example.com',
        displayName: 'Asha',
      });
      open();
      button('Cancel').click();
      fixture.detectChanges();
      expect(el().querySelector('.name-form')).toBeNull();
      expect(updateDisplayName).not.toHaveBeenCalled();
      flush();
    }));
  });
});
