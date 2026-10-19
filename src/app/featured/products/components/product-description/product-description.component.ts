import { Component, Input } from '@angular/core';

import { FavoriteButtonComponent } from 'src/app/core/favorites/favorite-button/favorite-button.component';
import { FavoriteDrink } from 'src/app/core/favorites/favorite.model';
import { Recipe, isMenuDescription } from '../../models/recipe.model';
import { drinkLabel } from '../../utils/drink-filters';

// Categories that add nothing next to "Cocktail" / "Mocktail".
const UNHELPFUL_CATEGORIES = ['Cocktail', 'Ordinary Drink', 'Other / Unknown'];

/** The recipe's name and the facts worth knowing before making it. */
@Component({
  selector: 'app-product-description',
  standalone: true,
  imports: [FavoriteButtonComponent],
  templateUrl: './product-description.component.html',
  styleUrl: './product-description.component.scss',
})
export class ProductDescriptionComponent {
  @Input({ required: true }) recipe!: Recipe;
  /** 1 on the recipe page; 2 where the recipe sits inside another page, e.g. Surprise Me. */
  @Input() headingLevel: 1 | 2 = 1;

  /** What the Save button saves; a person's own recipe has its own page instead. */
  get favorite(): FavoriteDrink | null {
    // The same object every time, so the button's input only changes with the drink.
    return this.recipe.source === 'own' ? null : (this.recipe as FavoriteDrink);
  }

  get eyebrow(): string {
    const category = this.recipe.category;
    const useful =
      category && !UNHELPFUL_CATEGORIES.includes(category) ? category : '';
    const menu = isMenuDescription(this.recipe) ? 'Menu description' : '';
    return [drinkLabel(this.recipe), useful, menu].filter(Boolean).join(' · ');
  }

  get facts(): { label: string; value: string }[] {
    const { glass, garnish, servings, iba, flavours, tastes, ice, serving } =
      this.recipe;
    const facts = [
      { label: 'Flavour', value: flavours?.join(', ') },
      { label: 'Taste', value: sentenceCase(tastes?.join(', ')) },
      { label: 'Glass', value: glass },
      { label: 'Ice', value: ice },
      { label: 'Garnish', value: garnish },
      { label: 'Serving', value: serving },
      { label: 'Serves', value: servings?.toString() },
      { label: 'IBA list', value: iba },
    ];
    return facts.filter(
      (f): f is { label: string; value: string } => !!f.value
    );
  }

  /**
   * TheCocktailDB states no taste, ice or serving notes; when shown, they were read
   * from its ingredients and method, and the page says so once.
   */
  get derivedNote(): string {
    const { source, tastes, ice, serving } = this.recipe;
    if (source !== 'cocktaildb') return '';
    const parts = [
      tastes?.length ? 'taste' : '',
      ice ? 'ice' : '',
      serving ? 'serving' : '',
    ].filter(Boolean);
    if (!parts.length) return '';
    const list =
      parts.length < 2
        ? parts[0]
        : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
    return `${sentenceCase(list)} ${parts.length === 1 ? 'is' : 'are'} read from the recipe’s ingredients and method.`;
  }
}

function sentenceCase(text: string | undefined): string | undefined {
  return text && text.charAt(0).toUpperCase() + text.slice(1);
}
