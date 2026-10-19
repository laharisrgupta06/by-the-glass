import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FavoriteButtonComponent } from 'src/app/core/favorites/favorite-button/favorite-button.component';
import { FavoriteDrink } from 'src/app/core/favorites/favorite.model';
import { Recipe } from '../../models/recipe.model';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, FavoriteButtonComponent],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent {
  @Input({ required: true }) recipe!: Recipe;
  /** One short line, e.g. "Cocktail · with lime juice". */
  @Input() detail = '';
  /** An optional emphasised line under the detail, e.g. "Missing: Lime juice". */
  @Input() note = '';
  /** Load the photo straight away; use for the first row, which is usually on screen. */
  @Input() eager = false;
  /** Where the card leads; a catalogue drink's page unless given (e.g. your own recipe). */
  @Input() link: unknown[] | string | null = null;
  /** A short line about the drink, e.g. a recipe's own description. */
  @Input() description = '';

  get target(): unknown[] | string {
    return this.link ?? ['/product-details', this.recipe.id];
  }

  /** Catalogue and venue drinks can be saved; a person's own recipe isn't a card here. */
  get favorite(): FavoriteDrink | null {
    return this.recipe.source === 'own' ? null : (this.recipe as FavoriteDrink);
  }
}
