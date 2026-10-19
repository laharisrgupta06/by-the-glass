import { Component, computed, inject } from '@angular/core';

import { usingFirebaseEmulators } from 'src/app/core/firebase/firebase';
import { SavedRecipesService } from 'src/app/core/saved-recipes/saved-recipes.service';
import { ProductCardComponent } from '../../../products/components/product-card/product-card.component';
import { Recipe } from '../../../products/models/recipe.model';

/** AI-curated recipes saved from What Can I Make?, as cards that open the full recipe. */
@Component({
  selector: 'app-saved-recipes-section',
  standalone: true,
  imports: [ProductCardComponent],
  templateUrl: './saved-recipes-section.component.html',
  styleUrl: './saved-recipes-section.component.scss',
})
export class SavedRecipesSectionComponent {
  readonly saved = inject(SavedRecipesService);
  readonly usingEmulators = usingFirebaseEmulators;

  readonly cards = computed(() =>
    this.saved.recipes().map(item => {
      // Shown with the Drinks page card; like your own recipes, not a favourite.
      const recipe: Recipe = {
        id: item.id,
        source: 'own',
        credit: 'Gemini',
        name: item.recipe.name,
        kind: item.recipe.kind,
        description: item.recipe.description,
        ingredients: [],
        translations: [],
        hasDetails: true,
      };
      const kind = item.recipe.kind === 'mocktail' ? 'Mocktail' : 'Cocktail';
      return { id: item.id, recipe, detail: `AI-curated · ${kind}` };
    })
  );
}
