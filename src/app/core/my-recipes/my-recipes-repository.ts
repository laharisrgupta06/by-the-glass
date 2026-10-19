import { Injectable } from '@angular/core';

import { FirestoreMyRecipesRepository } from './firestore-my-recipes.repository';
import { MyRecipe, MyRecipeDraft, MyRecipeImage } from './my-recipe.model';

/** Where people's own recipes are kept. Swap the backend by providing another class. */
@Injectable({ providedIn: 'root', useClass: FirestoreMyRecipesRepository })
export abstract class MyRecipesRepository {
  /** Streams the user's recipes; `fromCache` means the backend wasn't reached. */
  abstract watch(
    userId: string,
    onChange: (recipes: MyRecipe[], fromCache: boolean) => void,
    onError: () => void
  ): () => void;
  abstract create(
    userId: string,
    id: string,
    draft: MyRecipeDraft,
    image: MyRecipeImage | null
  ): Promise<void>;
  /** `image`: a new photo, null to remove it, or undefined to leave it as it is. */
  abstract update(
    userId: string,
    id: string,
    draft: MyRecipeDraft,
    image?: MyRecipeImage | null
  ): Promise<void>;
  abstract remove(userId: string, id: string): Promise<void>;
  /** Stores a photo in the owner's folder for the recipe; returns where it is. */
  abstract uploadImage(
    userId: string,
    recipeId: string,
    blob: Blob,
    contentType: string
  ): Promise<MyRecipeImage>;
  abstract deleteImage(path: string): Promise<void>;
}
