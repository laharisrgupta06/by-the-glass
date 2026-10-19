import { Injectable } from '@angular/core';

import { firebaseServices } from '../firebase/firebase';
import {
  SAVED_RECIPE_SCHEMA_VERSION,
  SavedRecipe,
  readSavedRecipe,
} from './saved-recipe.model';
import type { SavedRecipesRepository } from './saved-recipes-repository';

/** Firestore security rules (firestore.rules) keep each user's recipes private. */
@Injectable()
export class FirestoreSavedRecipesRepository implements SavedRecipesRepository {
  watch(
    userId: string,
    onChange: (recipes: SavedRecipe[], fromCache: boolean) => void,
    onError: () => void
  ): () => void {
    let unsubscribe: (() => void) | undefined;
    let stopped = false;
    firebaseServices().then(({ firestore, db }) => {
      if (stopped) return;
      unsubscribe = firestore.onSnapshot(
        firestore.collection(db, 'users', userId, 'savedRecipes'),
        { includeMetadataChanges: true },
        snapshot =>
          onChange(
            snapshot.docs.flatMap(doc => {
              const saved = readSavedRecipe(
                doc.id,
                doc.data({ serverTimestamps: 'estimate' })
              );
              return saved ? [saved] : [];
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

  /** The whole validated recipe is stored, not just its name. */
  async add(
    userId: string,
    { id, origin, recipe, basedOn }: Omit<SavedRecipe, 'createdAt'>
  ): Promise<void> {
    const { firestore, db } = await firebaseServices();
    await firestore.setDoc(
      firestore.doc(db, 'users', userId, 'savedRecipes', id),
      {
        userId,
        origin,
        schemaVersion: SAVED_RECIPE_SCHEMA_VERSION,
        recipe: {
          name: recipe.name,
          kind: recipe.kind,
          description: recipe.description,
          ingredients: recipe.ingredients.map(i => ({
            name: i.name,
            amount: i.amount,
            origin: i.origin,
            optional: i.optional,
          })),
          steps: recipe.steps,
          glass: recipe.glass,
          ice: recipe.ice,
          garnish: recipe.garnish,
          serving: recipe.serving,
        },
        basedOn,
        createdAt: firestore.serverTimestamp(),
      }
    );
  }

  async remove(userId: string, id: string): Promise<void> {
    const { firestore, db } = await firebaseServices();
    await firestore.deleteDoc(
      firestore.doc(db, 'users', userId, 'savedRecipes', id)
    );
  }
}
