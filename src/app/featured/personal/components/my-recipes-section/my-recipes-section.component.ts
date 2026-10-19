import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { usingFirebaseEmulators } from 'src/app/core/firebase/firebase';
import { toDisplayRecipe } from 'src/app/core/my-recipes/my-recipe.model';
import { MyRecipesService } from 'src/app/core/my-recipes/my-recipes.service';
import { ProductCardComponent } from '../../../products/components/product-card/product-card.component';

/** Recipes the person wrote themselves, as cards like the Drinks page, with Edit and Delete. */
@Component({
  selector: 'app-my-recipes-section',
  standalone: true,
  imports: [RouterLink, ProductCardComponent],
  templateUrl: './my-recipes-section.component.html',
  styleUrl: './my-recipes-section.component.scss',
})
export class MyRecipesSectionComponent {
  readonly recipes = inject(MyRecipesService);
  readonly usingEmulators = usingFirebaseEmulators;
  /** The recipe whose Delete is waiting for a second, explicit click. */
  readonly confirming = signal<string | null>(null);

  readonly cards = computed(() =>
    this.recipes.recipes().map(recipe => ({
      id: recipe.id,
      recipe: toDisplayRecipe(recipe),
      detail: [
        recipe.kind === 'mocktail' ? 'Mocktail' : 'Cocktail',
        `${recipe.ingredients.length} ${recipe.ingredients.length === 1 ? 'ingredient' : 'ingredients'}`,
      ].join(' · '),
    }))
  );

  async remove(id: string): Promise<void> {
    await this.recipes.remove(id);
    this.confirming.set(null);
  }
}
