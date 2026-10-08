import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FavoriteRecord } from 'src/app/core/favorites/favorite.model';
import { FavoritesService } from 'src/app/core/favorites/favorites.service';
import { ProductCardComponent } from '../../../products/components/product-card/product-card.component';
import { Recipe } from '../../../products/models/recipe.model';
import { kindLabel } from '../../../products/utils/drink-filters';

/** A favorite rendered with the same card as the Drinks page. */
function toRecipe(favorite: FavoriteRecord): Recipe {
  return {
    id: favorite.drinkId,
    source: favorite.source,
    credit: '',
    name: favorite.name,
    thumbnail: favorite.thumbnail,
    kind: favorite.kind,
    ingredients: [],
    translations: [],
    hasDetails: false,
  };
}

@Component({
  selector: 'app-favorites-section',
  standalone: true,
  imports: [RouterLink, ProductCardComponent],
  templateUrl: './favorites-section.component.html',
  styleUrl: './favorites-section.component.scss',
})
export class FavoritesSectionComponent {
  readonly favorites = inject(FavoritesService);
  readonly skeletons = [0, 1, 2, 3];

  readonly cards = computed(() =>
    this.favorites.favorites().map(favorite => {
      const recipe = toRecipe(favorite);
      return { recipe, detail: kindLabel(recipe.kind) ?? '' };
    })
  );
}
