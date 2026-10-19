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
import { FavoriteDrink, FavoriteRecord, favoriteKey } from './favorite.model';
import { FavoritesRepository } from './favorites-repository';

export type FavoritesStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * The single source of truth for favorites. Cards, the details page and Personal
 * all read and change favorites through here, so they always agree.
 */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private auth = inject(AuthService);
  private repository = inject(FavoritesRepository);
  private authDialog = inject(AuthDialogService);
  private notice = inject(NoticeService);

  private records = signal(new Map<string, FavoriteRecord>());
  private busyKeys = signal(new Set<string>());
  private reloadToken = signal(0);
  readonly status = signal<FavoritesStatus>('idle');
  private status$ = toObservable(this.status);

  /** Newest first. */
  readonly favorites = computed(() =>
    [...this.records().values()].sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
    )
  );

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    // Follow whoever is signed in; signing out clears everything immediately.
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
        // Only the user and reloads should re-run this, not what the listener reads.
        const stop = untracked(() =>
          this.repository.watch(
            user.id,
            (favorites, fromCache) => {
              // Offline before the first server answer: don't pass an empty cache off as "no favorites".
              if (fromCache && this.status() !== 'ready') {
                this.status.set('error');
                return;
              }
              this.records.set(
                new Map(
                  favorites.map(f => [favoriteKey(f.source, f.drinkId), f])
                )
              );
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

  isFavorite(drink: Pick<FavoriteDrink, 'source' | 'id'>): boolean {
    return this.records().has(favoriteKey(drink.source, drink.id));
  }

  isBusy(drink: Pick<FavoriteDrink, 'source' | 'id'>): boolean {
    return this.busyKeys().has(favoriteKey(drink.source, drink.id));
  }

  reload(): void {
    this.reloadToken.update(n => n + 1);
  }

  /** Saves or removes. Signed-out visitors are asked to sign in, then the save completes. */
  async toggle(drink: FavoriteDrink): Promise<void> {
    if (this.auth.status() === 'unavailable') {
      this.notice.show('Saving drinks isn’t switched on yet.');
      return;
    }
    if (!this.auth.user()) {
      const signedIn = await this.authDialog.open({
        mode: 'sign-in',
        reason: `Sign in to save ${drink.name} to your cabinet.`,
      });
      if (!signedIn) return;
      // Wait for their favorites so we don't re-save something already there.
      const status = await firstValueFrom(
        this.status$.pipe(filter(s => s === 'ready' || s === 'error'))
      );
      if (status === 'error' || this.isFavorite(drink)) return;
    }
    await this.write(drink, !this.isFavorite(drink));
  }

  private async write(drink: FavoriteDrink, save: boolean): Promise<void> {
    const user = this.auth.user();
    const key = favoriteKey(drink.source, drink.id);
    if (!user || this.busyKeys().has(key)) return;

    const previous = this.records().get(key);
    this.setBusy(key, true);
    // Update right away; the live listener confirms, and we roll back on failure.
    this.setRecord(
      key,
      save
        ? {
            userId: user.id,
            source: drink.source,
            drinkId: drink.id,
            name: drink.name,
            thumbnail: drink.thumbnail,
            kind: drink.kind,
            createdAt: new Date(),
          }
        : undefined
    );

    try {
      if (save) await this.repository.add(user.id, drink);
      else await this.repository.remove(user.id, drink);
    } catch {
      this.setRecord(key, save ? undefined : previous);
      this.notice.show(
        save
          ? `Couldn’t save ${drink.name}. Please try again.`
          : `Couldn’t remove ${drink.name}. Please try again.`
      );
    } finally {
      this.setBusy(key, false);
    }
  }

  private setRecord(key: string, record: FavoriteRecord | undefined): void {
    this.records.update(records => {
      const next = new Map(records);
      if (record) next.set(key, record);
      else next.delete(key);
      return next;
    });
  }

  private setBusy(key: string, busy: boolean): void {
    this.busyKeys.update(keys => {
      const next = new Set(keys);
      if (busy) next.add(key);
      else next.delete(key);
      return next;
    });
  }
}
