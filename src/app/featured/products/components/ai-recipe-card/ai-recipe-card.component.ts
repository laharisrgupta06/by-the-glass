import { Component, Input } from '@angular/core';

import { AiRecipe, AiRecipeIngredient } from 'src/app/core/ai/ai-recipe';

let nextId = 0;

/**
 * A recipe created by AI, shown as a full recipe card and always labelled as such.
 * Ingredients say where they come from: the list the recipe was built from (the
 * venue's menu, or the person's own ingredients) or added by the AI.
 */
@Component({
  selector: 'app-ai-recipe-card',
  standalone: true,
  templateUrl: './ai-recipe-card.component.html',
  styleUrl: './ai-recipe-card.component.scss',
})
export class AiRecipeCardComponent {
  @Input({ required: true }) recipe!: AiRecipe;
  @Input() label = 'AI-curated recipe';
  /** Says the quantities and method are an approximation, and by whom. */
  @Input() disclaimer = '';
  /** e.g. "Listed on the menu" or "You have". */
  @Input() givenLabel = 'Listed';
  /** e.g. "Not on the menu" or "You'd need". */
  @Input() extraLabel = 'Added';

  readonly titleId = `ai-recipe-${nextId++}`;

  tag(ingredient: AiRecipeIngredient): string {
    if (ingredient.origin === 'given') return this.givenLabel;
    return ingredient.optional
      ? `${this.extraLabel} · optional`
      : this.extraLabel;
  }
}
