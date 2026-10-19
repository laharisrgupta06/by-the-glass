import { Injectable } from '@angular/core';

import {
  firebaseServices,
  firebaseStorage,
  storageEmulatorRunning,
  usingFirebaseEmulators,
} from '../firebase/firebase';
import {
  MY_RECIPE_SCHEMA_VERSION,
  MyRecipe,
  MyRecipeDraft,
  MyRecipeImage,
  readMyRecipe,
} from './my-recipe.model';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
import type { MyRecipesRepository } from './my-recipes-repository';

/** The fields stored for a recipe: exactly these, trimmed (firestore.rules checks them). */
function fields(userId: string, draft: MyRecipeDraft) {
  return {
    userId,
    schemaVersion: MY_RECIPE_SCHEMA_VERSION,
    name: draft.name.trim(),
    description: draft.description.trim(),
    kind: draft.kind,
    ingredients: draft.ingredients.map(i => ({
      name: i.name.trim(),
      quantity: i.quantity.trim(),
      unit: i.unit,
    })),
    steps: draft.steps.map(s => s.trim()),
    glass: draft.glass.trim(),
    ice: draft.ice.trim(),
    garnish: draft.garnish.trim(),
  };
}

/** Firestore security rules (firestore.rules) keep each user's recipes private. */
@Injectable()
export class FirestoreMyRecipesRepository implements MyRecipesRepository {
  watch(
    userId: string,
    onChange: (recipes: MyRecipe[], fromCache: boolean) => void,
    onError: () => void
  ): () => void {
    let unsubscribe: (() => void) | undefined;
    let stopped = false;
    firebaseServices().then(({ firestore, db }) => {
      if (stopped) return;
      unsubscribe = firestore.onSnapshot(
        firestore.collection(db, 'users', userId, 'myRecipes'),
        { includeMetadataChanges: true },
        snapshot =>
          onChange(
            snapshot.docs.flatMap(doc => {
              const recipe = readMyRecipe(
                doc.id,
                doc.data({ serverTimestamps: 'estimate' })
              );
              return recipe ? [recipe] : [];
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

  async create(
    userId: string,
    id: string,
    draft: MyRecipeDraft,
    image: MyRecipeImage | null
  ): Promise<void> {
    const { firestore, db } = await firebaseServices();
    await firestore.setDoc(this.ref(firestore, db, userId, id), {
      ...fields(userId, draft),
      ...(image ? { image } : {}),
      createdAt: firestore.serverTimestamp(),
      updatedAt: firestore.serverTimestamp(),
    });
  }

  /** Replaces the recipe's content; when it was created stays as it was. */
  async update(
    userId: string,
    id: string,
    draft: MyRecipeDraft,
    image?: MyRecipeImage | null
  ): Promise<void> {
    const { firestore, db } = await firebaseServices();
    await firestore.updateDoc(this.ref(firestore, db, userId, id), {
      ...fields(userId, draft),
      // Left out means "keep the photo"; null removes it.
      ...(image === undefined
        ? {}
        : { image: image ?? firestore.deleteField() }),
      updatedAt: firestore.serverTimestamp(),
    });
  }

  async uploadImage(
    userId: string,
    recipeId: string,
    blob: Blob,
    contentType: string
  ): Promise<MyRecipeImage> {
    if (usingFirebaseEmulators && !(await storageEmulatorRunning()))
      throw Object.assign(new Error('Storage emulator not running'), {
        code: 'storage/emulator-unavailable',
      });
    const { storageModule, storage } = await firebaseStorage();
    // A new name each time, so a replaced photo is never served from an old cache.
    const extension = EXTENSIONS[contentType] ?? 'jpg';
    const path = `users/${userId}/myRecipes/${recipeId}/photo-${Date.now()}.${extension}`;
    const ref = storageModule.ref(storage, path);
    await storageModule.uploadBytes(ref, blob, { contentType });
    return { path, url: await storageModule.getDownloadURL(ref) };
  }

  async deleteImage(path: string): Promise<void> {
    const { storageModule, storage } = await firebaseStorage();
    await storageModule.deleteObject(storageModule.ref(storage, path));
  }

  async remove(userId: string, id: string): Promise<void> {
    const { firestore, db } = await firebaseServices();
    await firestore.deleteDoc(this.ref(firestore, db, userId, id));
  }

  private ref(
    firestore: Awaited<ReturnType<typeof firebaseServices>>['firestore'],
    db: Awaited<ReturnType<typeof firebaseServices>>['db'],
    userId: string,
    id: string
  ) {
    return firestore.doc(db, 'users', userId, 'myRecipes', id);
  }
}
