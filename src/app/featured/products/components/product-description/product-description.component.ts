import { Component, Input } from '@angular/core';

import { Recipe } from '../../models/recipe.model';
import { kindLabel } from '../../utils/drink-filters';

// Categories that add nothing next to "Cocktail" / "Mocktail".
const UNHELPFUL_CATEGORIES = ['Cocktail', 'Ordinary Drink', 'Other / Unknown'];

/** The recipe's name and the facts worth knowing before making it. */
@Component({
  selector: 'app-product-description',
  standalone: true,
  templateUrl: './product-description.component.html',
  styleUrl: './product-description.component.scss',
})
export class ProductDescriptionComponent {
  @Input({ required: true }) recipe!: Recipe;

  get eyebrow(): string {
    const category = this.recipe.category;
    const useful =
      category && !UNHELPFUL_CATEGORIES.includes(category) ? category : '';
    return [kindLabel(this.recipe.kind), useful].filter(Boolean).join(' · ');
  }

  get facts(): { label: string; value: string }[] {
    const { glass, garnish, servings, iba } = this.recipe;
    const facts = [
      { label: 'Glass', value: glass },
      { label: 'Garnish', value: garnish },
      { label: 'Serves', value: servings?.toString() },
      { label: 'IBA list', value: iba },
    ];
    return facts.filter(
      (f): f is { label: string; value: string } => !!f.value
    );
  }
}
