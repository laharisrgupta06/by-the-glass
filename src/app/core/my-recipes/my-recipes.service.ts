import {
  Injectable,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';

import { AuthDialogService } from '../auth/auth-dialog.service';
import { AuthService } from '../auth/auth.service';
import { NoticeService } from '../notice/notice.service';
import {
  ImageChange,
  MyRecipe,
  MyRecipeDraft,
  MyRecipeImage,
  isSaveable,
  newRecipeId,
} from './my-recipe.model';
import { MyRecipesRepository } from './my-recipes-repository';

export type MyRecipesStatus = 'idle' | 'loading' | 'ready' | 'error';

/** How long to wait for the database to confirm a save before saying so. */
export const SAVE_TIMEOUT_MS = 20_000;
const RECIPE_ID = /^[A-Za-z0-9]{20}$/;

class SaveTimeout extends Error {}

function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    work,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new SaveTimeout()), SAVE_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}

const codeOf = (error: unknown) => (error as { code?: string })?.code ?? '';

/** What went wrong with a photo upload, and what to do about it. */
export function photoFailure(error: unknown): string {
  const keep = 'Nothing was saved yet; your recipe and photo are still here.';
  switch (codeOf(error)) {
    case 'storage/emulator-unavailable':
      return `Photo uploads need the local Storage emulator, and it isn’t running. Restart the emulators with npm run emulators, then save again. ${keep}`;
    case 'storage/unauthorized':
    case 'storage/unauthenticated':
      return `The photo was refused. Check you’re still signed in, and use a JPEG, PNG or WebP photo. ${keep}`;
    case 'storage/retry-limit-exceeded':
    case 'storage/canceled':
      return `Uploading the photo took too long. Check your connection and try again, or remove the photo to save without it. ${keep}`;
    case 'storage/quota-exceeded':
      return `Photo storage isn’t available right now. Remove the photo to save without it. ${keep}`;
    default:
      return `Couldn’t upload the photo. Try again, or remove the photo to save without it. ${keep}`;
  }
}

/** What went wrong saving the recipe itself. */
function recipeFailure(error: unknown): string {
  if (error instanceof SaveTimeout)
    return 'Saving is taking too long, so we stopped waiting. Check your connection; if the recipe shows up in My recipes it was saved, otherwise save again.';
  if (codeOf(error) === 'permission-denied')
    return 'Your recipe was refused. Check you’re still signed in, then try again.';
  return 'Couldn’t save your recipe. Check your connection and try again; everything you entered is still here.';
}

/**
 * The signed-in person's own recipes: create, edit, delete. Follows whoever is signed
 * in, like favorites and saved recipes, through the same authentication and Firestore.
 */
@Injectable({ providedIn: 'root' })
export class MyRecipesService {
  private auth = inject(AuthService);
  private repository = inject(MyRecipesRepository);
  private authDialog = inject(AuthDialogService);
  private notice = inject(NoticeService);

  private records = signal(new Map<string, MyRecipe>());
  private reloadToken = signal(0);
  readonly status = signal<MyRecipesStatus>('idle');
  readonly busy = signal(false);
  /** Why the last save didn't go through, to show beside the form; '' otherwise. */
  readonly saveError = signal('');
  private status$ = toObservable(this.status);

  /** Most recently changed first. */
  readonly recipes = computed(() =>
    [...this.records().values()].sort(
      (a, b) =>
        (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0) ||
        a.name.localeCompare(b.name)
    )
  );

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    effect(
      onCleanup => {
        const user = this.auth.user();
        this.reloadToken();
        this.records.set(new Map());
        if (!user) {
          this.status.set('idle');
          return;
        }
        this.status.set('loading');
        const stop = untracked(() =>
          this.repository.watch(
            user.id,
            (recipes, fromCache) => {
              if (fromCache && this.status() !== 'ready') {
                this.status.set('error');
                return;
              }
              this.records.set(new Map(recipes.map(r => [r.id, r])));
              this.status.set('ready');
            },
            () => this.status.set('error')
          )
        );
        onCleanup(stop);
      },
      { allowSignalWrites: true }
    );
  }

  byId(id: string): MyRecipe | undefined {
    return this.records().get(id);
  }

  reload(): void {
    this.reloadToken.update(n => n + 1);
  }

  /**
   * Saves a new recipe or the changes to an existing one (`id`), and returns its id;
   * null when nothing was saved, with the reason in `saveError`. Signed-out visitors
   * are asked to sign in first. A photo is uploaded before the recipe is saved; if that
   * fails, nothing is saved and the form keeps everything the person entered.
   * `newId` keeps a new recipe's id the same across retries, so a save that went
   * through after all is updated rather than duplicated.
   */
  async save(
    draft: MyRecipeDraft,
    id?: string,
    imageChange: ImageChange = { kind: 'keep' },
    newId?: string
  ): Promise<string | null> {
    if (!isSaveable(draft) || this.busy()) return null;
    this.saveError.set('');
    if (this.auth.status() === 'unavailable') {
      this.saveError.set('Saving recipes isn’t switched on yet.');
      return null;
    }
    if (!this.auth.user()) {
      const signedIn = await this.authDialog.open({
        mode: 'sign-in',
        reason: 'Sign in to save your recipe. It stays private to you.',
      });
      if (!signedIn) return null;
      await firstValueFrom(
        this.status$.pipe(filter(s => s === 'ready' || s === 'error'))
      );
    }
    const user = this.auth.user();
    if (!user) return null;
    // Editing needs a recipe of this person's; anything else is created anew.
    const existing = [id, newId].find(
      (key): key is string => !!key && this.records().has(key)
    );
    const editing = !!existing;
    const recipeId =
      existing ?? (newId && RECIPE_ID.test(newId) ? newId : newRecipeId());
    const previous = editing ? this.records().get(recipeId)!.image : null;
    this.busy.set(true);
    let uploaded: MyRecipeImage | null = null;
    try {
      if (imageChange.kind === 'set') {
        try {
          uploaded = await this.repository.uploadImage(
            user.id,
            recipeId,
            imageChange.blob,
            imageChange.contentType
          );
        } catch (error) {
          this.saveError.set(photoFailure(error));
          return null;
        }
      }
      const image =
        imageChange.kind === 'set'
          ? uploaded
          : imageChange.kind === 'remove'
            ? null
            : undefined;
      const write = editing
        ? this.repository.update(user.id, recipeId, draft, image)
        : this.repository.create(user.id, recipeId, draft, image ?? null);
      // A replaced or removed photo is no longer used by anything.
      const tidyPhotos = () => {
        if (previous && imageChange.kind !== 'keep')
          this.repository.deleteImage(previous.path).catch(() => undefined);
      };
      try {
        await withTimeout(write);
      } catch (error) {
        if (!(error instanceof SaveTimeout)) throw error;
        // Stop waiting, but the write is still on its way: if it lands, say so.
        const message = recipeFailure(error);
        write.then(
          () => {
            tidyPhotos();
            if (this.saveError() === message) this.saveError.set('');
            this.notice.show('Your recipe was saved after all.');
          },
          () => undefined
        );
        this.saveError.set(message);
        return null;
      }
      tidyPhotos();
      this.notice.show(
        editing ? 'Recipe updated.' : 'Recipe saved to My recipes.'
      );
      return recipeId;
    } catch (error) {
      // Don't leave a photo behind for a recipe that wasn't saved.
      if (uploaded)
        this.repository.deleteImage(uploaded.path).catch(() => undefined);
      this.saveError.set(recipeFailure(error));
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  async remove(id: string): Promise<boolean> {
    const user = this.auth.user();
    const recipe = this.records().get(id);
    if (!user || !recipe || this.busy()) return false;
    this.busy.set(true);
    try {
      await this.repository.remove(user.id, id);
      if (recipe.image)
        this.repository.deleteImage(recipe.image.path).catch(() => undefined);
      this.notice.show(`${recipe.name} deleted.`);
      return true;
    } catch {
      this.notice.show(`Couldn’t delete ${recipe.name}. Try again.`);
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
