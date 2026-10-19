import { Injectable } from '@angular/core';

import { firebaseServices } from '../firebase/firebase';
import { FavoriteDrink, FavoriteRecord, favoriteKey } from './favorite.model';
import type { FavoritesRepository } from './favorites-repository';

/** Firestore security rules (firestore.rules) keep each user's favorites private. */
@Injectable()
export class FirestoreFavoritesRepository implements FavoritesRepository {
  watch(
    userId: string,
    onChange: (favorites: FavoriteRecord[], fromCache: boolean) => void,
    onError: () => void
  ): () => void {
    let unsubscribe: (() => void) | undefined;
    let stopped = false;
    firebaseServices().then(({ firestore, db }) => {
      if (stopped) return;
      unsubscribe = firestore.onSnapshot(
        firestore.collection(db, 'users', userId, 'favorites'),
        { includeMetadataChanges: true },
        snapshot =>
          onChange(
            snapshot.docs.map(doc => {
              // Saves still waiting on the server get an estimated timestamp.
              const data = doc.data({ serverTimestamps: 'estimate' });
              return {
                userId,
                source: data['source'],
                drinkId: data['drinkId'],
                name: data['name'],
                thumbnail: data['thumbnail'],
                kind: data['kind'],
                createdAt: data['createdAt']?.toDate() ?? null,
              };
            }),
            snapshot.metadata.fromCache
          ),
        onError
      );
    }, onError);
    return () => {
      stopped = true;
      unsubscribe?.();
    };
  }

  async add(userId: string, drink: FavoriteDrink): Promise<void> {
    const { firestore, db } = await firebaseServices();
    const record: Record<string, unknown> = {
      userId,
      source: drink.source,
      drinkId: drink.id,
      name: drink.name,
      createdAt: firestore.serverTimestamp(),
    };
    if (drink.thumbnail) record['thumbnail'] = drink.thumbnail;
    if (drink.kind) record['kind'] = drink.kind;
    await firestore.setDoc(this.ref(db, firestore, userId, drink), record);
  }

  async remove(userId: string, drink: FavoriteDrink): Promise<void> {
    const { firestore, db } = await firebaseServices();
    await firestore.deleteDoc(this.ref(db, firestore, userId, drink));
  }

  private ref(
    db: Awaited<ReturnType<typeof firebaseServices>>['db'],
    firestore: Awaited<ReturnType<typeof firebaseServices>>['firestore'],
    userId: string,
    drink: FavoriteDrink
  ) {
    return firestore.doc(
      db,
      'users',
      userId,
      'favorites',
      favoriteKey(drink.source, drink.id)
    );
  }
}
