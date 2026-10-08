import { Injectable } from '@angular/core';

import { FavoriteDrink, FavoriteRecord } from './favorite.model';
import { FirestoreFavoritesRepository } from './firestore-favorites.repository';

/** Where favorites are persisted. Swap the backend by providing another class. */
@Injectable({ providedIn: 'root', useClass: FirestoreFavoritesRepository })
export abstract class FavoritesRepository {
  /**
   * Streams the user's favorites, now and on every change. `fromCache` is true when
   * the backend couldn't be reached and the list may be incomplete. Returns an unsubscribe.
   */
  abstract watch(
    userId: string,
    onChange: (favorites: FavoriteRecord[], fromCache: boolean) => void,
    onError: () => void
  ): () => void;
  abstract add(userId: string, drink: FavoriteDrink): Promise<void>;
  abstract remove(userId: string, drink: FavoriteDrink): Promise<void>;
}
