import { Injectable } from '@angular/core';

import { environment } from '../../../environments/environment';
import { firebaseServices, firebaseStorage } from '../firebase/firebase';
import {
  INLINE_PHOTO_MAX_URL_LENGTH,
  INLINE_PHOTO_PATH,
  MY_RECIPE_SCHEMA_VERSION,
  MyRecipe,
  MyRecipeDraft,
  MyRecipeImage,
  readMyRecipe,
} from './my-recipe.model';
import type { MyRecipesRepository } from './my-recipes-repository';

// The types firestore.rules accepts for an inline photo (preparePhoto makes these).
const INLINE_TYPES = ['image/webp', 'image/jpeg'];

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

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

  /**
   * Keeps the photo in the recipe document itself, as a data: URL: no Cloud Storage,
   * so it works on Firebase's free plan. The recipe write that follows stores it.
   */
  async uploadImage(
    _userId: string,
    _recipeId: string,
    blob: Blob,
    contentType: string
  ): Promise<MyRecipeImage> {
    if (!INLINE_TYPES.includes(contentType))
      throw Object.assign(new Error('Unsupported photo type'), {
        code: 'photo/unsupported',
      });
    const url = `data:${contentType};base64,${await toBase64(blob)}`;
    if (url.length > INLINE_PHOTO_MAX_URL_LENGTH)
      throw Object.assign(new Error('Photo too large'), {
        code: 'photo/too-large',
      });
    return { path: INLINE_PHOTO_PATH, url };
  }

  /** Inline photos go with their recipe; older ones in Cloud Storage are deleted there. */
  async deleteImage(path: string): Promise<void> {
    if (path === INLINE_PHOTO_PATH || !environment.firebase.storageBucket)
      return;
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
