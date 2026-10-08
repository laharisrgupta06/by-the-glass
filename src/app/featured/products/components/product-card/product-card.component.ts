import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Recipe } from '../../models/recipe.model';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent {
  @Input({ required: true }) recipe!: Recipe;
  /** One short line, e.g. "Cocktail · with lime juice". */
  @Input() detail = '';
}
