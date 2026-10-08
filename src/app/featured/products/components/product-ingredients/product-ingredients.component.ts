import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { RecipeIngredient } from '../../models/recipe.model';
import { metricHint } from '../../utils/recipe-text';

@Component({
  selector: 'app-product-ingredients',
  standalone: true,
  templateUrl: './product-ingredients.component.html',
  styleUrl: './product-ingredients.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductIngredientsComponent {
  @Input() title = 'Ingredients';
  @Input() set ingredients(value: RecipeIngredient[]) {
    this.rows = value.map(ingredient => ({
      ...ingredient,
      metric: metricHint(ingredient.measure),
    }));
    this.missingMeasures = value.some(ingredient => !ingredient.measure);
  }

  rows: (RecipeIngredient & { metric?: string })[] = [];
  missingMeasures = false;
}
