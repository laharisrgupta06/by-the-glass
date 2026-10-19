import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  flushMicrotasks,
  tick,
} from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  ActivatedRoute,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { AuthService } from 'src/app/core/auth/auth.service';
import { MyRecipe } from 'src/app/core/my-recipes/my-recipe.model';
import { MyRecipesService } from 'src/app/core/my-recipes/my-recipes.service';
import { RecipeEditorComponent } from './recipe-editor.component';

const SAVED: MyRecipe = {
  id: 'AbCdEfGhIjKlMnOpQrSt',
  name: 'Garden Spritz',
  description: 'Bright and herbal.',
  kind: 'cocktail',
  ingredients: [
    { name: 'Gin', quantity: '45', unit: 'ml' },
    { name: 'Soda water', quantity: '', unit: 'top up' },
  ],
  steps: ['Build over ice.', 'Top with soda.'],
  glass: 'Highball',
  ice: '',
  garnish: '',
  image: null,
  createdAt: null,
  updatedAt: null,
};

describe('RecipeEditorComponent', () => {
  let fixture: ComponentFixture<RecipeEditorComponent>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let service: {
    status: ReturnType<typeof signal>;
    busy: ReturnType<typeof signal>;
    byId: jasmine.Spy;
    save: jasmine.Spy;
    saveError: ReturnType<typeof signal<string>>;
  };
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');
  const type = (selector: string, value: string) => {
    const input = el().querySelector<HTMLInputElement | HTMLTextAreaElement>(
      selector
    )!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  function setUp(id: string | null = null, recipe: MyRecipe = SAVED) {
    params = new BehaviorSubject(convertToParamMap(id ? { id } : {}));
    service = {
      status: signal('ready'),
      busy: signal(false),
      byId: jasmine
        .createSpy('byId')
        .and.callFake((i: string) => (i === recipe.id ? recipe : undefined)),
      save: jasmine.createSpy('save').and.resolveTo(SAVED.id),
      saveError: signal(''),
    };
    TestBed.configureTestingModule({
      imports: [RecipeEditorComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
        { provide: MyRecipesService, useValue: service },
        { provide: AuthService, useValue: { status: signal('signed-in') } },
      ],
    });
    fixture = TestBed.createComponent(RecipeEditorComponent);
    fixture.detectChanges();
  }

  it('adds and removes ingredient rows, always keeping one', () => {
    setUp();
    const rows = () => el().querySelectorAll('.ingredient').length;
    expect(rows()).toBe(1);
    expect(
      el().querySelector<HTMLButtonElement>('.remove')!.disabled
    ).toBeTrue();
    el().querySelector<HTMLButtonElement>('.add')!.click();
    el().querySelector<HTMLButtonElement>('.add')!.click();
    fixture.detectChanges();
    expect(rows()).toBe(3);
    el().querySelectorAll<HTMLButtonElement>('.remove')[1].click();
    fixture.detectChanges();
    expect(rows()).toBe(2);
  });

  it('won’t save an incomplete recipe, and says what to fix', fakeAsync(() => {
    setUp();
    el().querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    fixture.detectChanges();
    tick();
    expect(service.save).not.toHaveBeenCalled();
    expect(text()).toContain('things need fixing before this can be saved');
    expect(text()).toContain('Add a name.');
    expect(text()).toContain('Add a short description.');
    expect(text()).toContain('Name the ingredient.');
    expect(text()).toContain('Add the method: one step per line.');
    expect(
      el().querySelector('#recipe-name')!.getAttribute('aria-invalid')
    ).toBe('true');
  }));

  it('previews the recipe with the same components as a recipe page', () => {
    setUp();
    type('#recipe-name', 'Garden Spritz');
    type('#recipe-description', 'Bright and herbal.');
    type('#ingredient-name-0', 'Gin');
    type('#ingredient-quantity-0', '1 1/2');
    const unit = el().querySelector<HTMLSelectElement>('#ingredient-unit-0')!;
    unit.value = 'oz';
    unit.dispatchEvent(new Event('change'));
    type('#recipe-method', 'Shake with ice\nStrain into a coupe');
    el().querySelector<HTMLButtonElement>('.secondary')!.click();
    fixture.detectChanges();
    const preview = el()
      .querySelector('.preview')!
      .textContent!.replace(/\s+/g, ' ');
    expect(preview).toContain('Garden Spritz');
    expect(preview).toContain('Bright and herbal.');
    expect(preview).toContain('1 1/2 oz ≈ 45 ml Gin');
    expect(preview).toContain('Shake with ice');
    expect(preview).toContain('Strain into a coupe');
    // Your own recipe: no AI label, no Save-as-favourite button.
    expect(preview).not.toContain('AI');
    expect(el().querySelector('.preview app-favorite-button')).toBeNull();
  });

  it('saves a complete recipe and opens it', fakeAsync(() => {
    setUp();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    type('#recipe-name', 'Garden Spritz');
    type('#recipe-description', 'Bright and herbal.');
    type('#ingredient-name-0', 'Gin');
    type('#ingredient-quantity-0', '45');
    type('#recipe-method', 'Build over ice.');
    el().querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    flushMicrotasks();
    const [draft, id, , newId] = service.save.calls.mostRecent().args;
    expect(id).toBeUndefined();
    expect(newId).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(draft).toEqual(
      jasmine.objectContaining({
        name: 'Garden Spritz',
        kind: 'cocktail',
        ingredients: [{ name: 'Gin', quantity: '45', unit: 'ml' }],
        steps: ['Build over ice.'],
      })
    );
    expect(router.navigate).toHaveBeenCalledWith([
      '/personal/recipes',
      SAVED.id,
    ]);
  }));

  it('edits a saved recipe: the form starts filled in and saves to the same id', fakeAsync(() => {
    setUp(SAVED.id);
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    expect(el().querySelector<HTMLInputElement>('#recipe-name')!.value).toBe(
      'Garden Spritz'
    );
    expect(el().querySelectorAll('.ingredient').length).toBe(2);
    expect(
      el().querySelector<HTMLTextAreaElement>('#recipe-method')!.value
    ).toBe('Build over ice.\nTop with soda.');
    type('#recipe-name', 'Garden Spritz No. 2');
    el().querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    flushMicrotasks();
    const [draft, id] = service.save.calls.mostRecent().args;
    expect(id).toBe(SAVED.id);
    expect(draft.name).toBe('Garden Spritz No. 2');
  }));

  it('after a failed save, says why beside the button and keeps the form; a retry reuses the new id', fakeAsync(() => {
    setUp();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    service.save.and.callFake(async () => {
      service.saveError.set('Couldn’t upload the photo. Try again.');
      return null;
    });
    type('#recipe-name', 'Garden Spritz');
    type('#recipe-description', 'Bright and herbal.');
    type('#ingredient-name-0', 'Gin');
    type('#ingredient-quantity-0', '45');
    type('#recipe-method', 'Build over ice.');
    const submit = el().querySelector<HTMLButtonElement>(
      'button[type=submit]'
    )!;
    submit.click();
    flushMicrotasks();
    fixture.detectChanges();
    expect(el().querySelector('.save-error')!.textContent).toContain(
      'Couldn’t upload the photo.'
    );
    expect(el().querySelector('.save-error')!.getAttribute('role')).toBe(
      'alert'
    );
    expect(el().querySelector<HTMLInputElement>('#recipe-name')!.value).toBe(
      'Garden Spritz'
    );
    expect(submit.disabled).toBeFalse();
    expect(router.navigate).not.toHaveBeenCalled();
    submit.click();
    flushMicrotasks();
    const [first, second] = service.save.calls.all().map(c => c.args[3]);
    expect(second).toBe(first);
  }));

  it('blocks a second submission while saving', () => {
    setUp(SAVED.id);
    service.busy.set(true);
    fixture.detectChanges();
    const submit = el().querySelector<HTMLButtonElement>(
      'button[type=submit]'
    )!;
    expect(submit.disabled).toBeTrue();
    expect(submit.textContent).toContain('Saving…');
  });

  it('says so when the recipe isn’t one of yours', () => {
    setUp('SomeoneElsesRecipe01');
    expect(text()).toContain("We couldn't find that recipe among yours.");
    expect(el().querySelector('form')).toBeNull();
  });

  describe('photo', () => {
    const WITH_PHOTO: MyRecipe = {
      ...SAVED,
      image: {
        path: 'users/u/myRecipes/x/photo-1.webp',
        url: 'https://storage.test/saved.webp',
      },
    };
    const pngFile = (): Promise<File> => {
      const canvas = document.createElement('canvas');
      canvas.width = 40;
      canvas.height = 30;
      canvas.getContext('2d')!.fillRect(0, 0, 40, 30);
      return new Promise(resolve =>
        canvas.toBlob(b =>
          resolve(new File([b!], 'drink.png', { type: 'image/png' }))
        )
      );
    };
    const choose = (file: File) =>
      fixture.componentInstance.choosePhoto({
        target: { files: [file], value: '' },
      } as unknown as Event);
    const enablePhotos = () => {
      (
        fixture.componentInstance as { photosAvailable: boolean }
      ).photosAvailable = true;
      fixture.detectChanges();
    };
    const button = (label: string) =>
      Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find(b =>
        b.textContent!.includes(label)
      )!;
    const submit = async () => {
      spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      el().querySelector<HTMLButtonElement>('button[type=submit]')!.click();
      await fixture.whenStable();
      return service.save.calls.mostRecent().args[2];
    };

    it('says plainly when this copy can’t take photos (no storage bucket configured)', () => {
      setUp(SAVED.id);
      expect(text()).toContain(
        "Photos can't be added in this copy of By the Glass yet."
      );
      expect(el().querySelector('input[type=file]')).toBeNull();
    });

    it('previews a chosen photo before saving, then uploads it on Save', async () => {
      setUp(SAVED.id);
      enablePhotos();
      expect(
        el().querySelector('input[type=file]')!.getAttribute('accept')
      ).toBe('image/jpeg,image/png,image/webp');
      await choose(await pngFile());
      fixture.detectChanges();
      expect(
        el().querySelector('.photo-preview img')!.getAttribute('src')
      ).toMatch(/^blob:/);
      expect(button('Replace photo')).toBeTruthy();
      expect(service.save).not.toHaveBeenCalled();
      const change = await submit();
      expect(change.kind).toBe('set');
      expect(change.blob instanceof Blob).toBeTrue();
    });

    it('keeps a saved photo untouched unless it’s replaced or removed', async () => {
      setUp(WITH_PHOTO.id, WITH_PHOTO);
      enablePhotos();
      expect(
        el().querySelector('.photo-preview img')!.getAttribute('src')
      ).toBe(WITH_PHOTO.image!.url);
      expect(await submit()).toEqual({ kind: 'keep' });
    });

    it('removes a saved photo', async () => {
      setUp(WITH_PHOTO.id, WITH_PHOTO);
      enablePhotos();
      button('Remove photo').click();
      fixture.detectChanges();
      expect(el().querySelector('.photo-preview img')).toBeNull();
      expect(button('Add a photo')).toBeTruthy();
      expect(await submit()).toEqual({ kind: 'remove' });
    });

    it('shows why a file was refused and leaves the form and photo as they were', async () => {
      setUp(WITH_PHOTO.id, WITH_PHOTO);
      enablePhotos();
      await choose(new File(['gif'], 'x.gif', { type: 'image/gif' }));
      fixture.detectChanges();
      expect(text()).toContain('Choose a JPEG, PNG or WebP photo.');
      expect(el().querySelector<HTMLInputElement>('#recipe-name')!.value).toBe(
        'Garden Spritz'
      );
      expect(
        el().querySelector('.photo-preview img')!.getAttribute('src')
      ).toBe(WITH_PHOTO.image!.url);
      expect(await submit()).toEqual({ kind: 'keep' });
    });
  });
});
