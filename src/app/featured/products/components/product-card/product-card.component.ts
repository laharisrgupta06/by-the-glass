import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FavoriteButtonComponent } from 'src/app/core/favorites/favorite-button/favorite-button.component';
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
  /** Load the photo straight away; use for the first row, which is usually on screen. */
  @Input() eager = false;
}
