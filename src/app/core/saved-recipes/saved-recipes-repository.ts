import { Injectable } from '@angular/core';

import { FirestoreSavedRecipesRepository } from './firestore-saved-recipes.repository';
import { SavedRecipe } from './saved-recipe.model';

/** Where saved recipes are persisted. Swap the backend by providing another class. */
@Injectable({ providedIn: 'root', useClass: FirestoreSavedRecipesRepository })
export abstract class SavedRecipesRepository {
  /**
   * Streams the user's saved recipes, now and on every change. `fromCache` is true when
   * the backend couldn't be reached. Returns an unsubscribe.
   */
  abstract watch(
    userId: string,
    onChange: (recipes: SavedRecipe[], fromCache: boolean) => void,
    onError: () => void
  ): () => void;
  abstract add(
    userId: string,
    recipe: Omit<SavedRecipe, 'createdAt'>
  ): Promise<void>;
  abstract remove(userId: string, id: string): Promise<void>;
}
