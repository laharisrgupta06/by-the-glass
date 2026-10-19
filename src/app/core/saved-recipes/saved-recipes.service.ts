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

import { AiRecipe, aiRecipeId } from '../ai/ai-recipe';
import { AuthDialogService } from '../auth/auth-dialog.service';
import { AuthService } from '../auth/auth.service';
import { NoticeService } from '../notice/notice.service';
import { SavedRecipe } from './saved-recipe.model';
import { SavedRecipesRepository } from './saved-recipes-repository';

export type SavedRecipesStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Recipes saved to Personal (AI-curated ones today). Follows whoever is signed in,
 * like favorites, through the same authentication and Firestore setup.
 */
@Injectable({ providedIn: 'root' })
export class SavedRecipesService {
  private auth = inject(AuthService);
  private repository = inject(SavedRecipesRepository);
  private authDialog = inject(AuthDialogService);
  private notice = inject(NoticeService);

  private records = signal(new Map<string, SavedRecipe>());
  private busyIds = signal(new Set<string>());
  private reloadToken = signal(0);
  readonly status = signal<SavedRecipesStatus>('idle');
  private status$ = toObservable(this.status);

  /** Newest first. */
  readonly recipes = computed(() =>
    [...this.records().values()].sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
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
              // Offline before the first server answer: an empty cache isn't "none saved".
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

  isSaved(recipe: AiRecipe): boolean {
    return this.records().has(aiRecipeId(recipe));
  }

  isBusy(recipe: AiRecipe): boolean {
    return this.busyIds().has(aiRecipeId(recipe));
  }

  reload(): void {
    this.reloadToken.update(n => n + 1);
  }

  /**
   * Saves the complete recipe once. Signed-out visitors are asked to sign in first,
   * as with favorites; saving the same recipe again changes nothing.
   */
  async save(recipe: AiRecipe, basedOn: string[]): Promise<void> {
    if (this.auth.status() === 'unavailable') {
      this.notice.show('Saving recipes isn’t switched on yet.');
      return;
    }
    if (!this.auth.user()) {
      const signedIn = await this.authDialog.open({
        mode: 'sign-in',
        reason: `Sign in to save ${recipe.name} to Personal.`,
      });
      if (!signedIn) return;
      const status = await firstValueFrom(
        this.status$.pipe(filter(s => s === 'ready' || s === 'error'))
      );
      if (status === 'error') return;
    }
    const user = this.auth.user();
    const id = aiRecipeId(recipe);
    if (!user || this.records().has(id) || this.busyIds().has(id)) return;

    this.setBusy(id, true);
    const saved: SavedRecipe = {
      id,
      origin: 'ai-curated',
      recipe,
      basedOn,
      createdAt: new Date(),
    };
    this.setRecord(id, saved);
    try {
      await this.repository.add(user.id, saved);
      this.notice.show(`${recipe.name} saved to Personal.`);
    } catch {
      this.setRecord(id, undefined);
      this.notice.show(`Couldn’t save ${recipe.name}. Try again.`);
    } finally {
      this.setBusy(id, false);
    }
  }

  async remove(saved: SavedRecipe): Promise<void> {
    const user = this.auth.user();
    if (!user || this.busyIds().has(saved.id)) return;
    this.setBusy(saved.id, true);
    this.setRecord(saved.id, undefined);
    try {
      await this.repository.remove(user.id, saved.id);
    } catch {
      this.setRecord(saved.id, saved);
      this.notice.show(`Couldn’t remove ${saved.recipe.name}. Try again.`);
    } finally {
      this.setBusy(saved.id, false);
    }
  }

  private setRecord(id: string, record: SavedRecipe | undefined): void {
    this.records.update(current => {
      const next = new Map(current);
      if (record) next.set(id, record);
      else next.delete(id);
      return next;
    });
  }

  private setBusy(id: string, busy: boolean): void {
    this.busyIds.update(current => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
