import { StoredMenuRecipe } from 'src/app/core/ai/ai-recipe';
import { Recipe, isMenuDescription } from '../../models/recipe.model';

/**
 * A venue drink shown with its stored AI-suggested recipe, in the usual recipe layout.
 * The menu's own name, description, flavour notes, section and credit are kept; the
 * amounts, method, glass, ice, garnish and serving come from the stored recipe, which
 * is never changed. Shown like any other recipe; optional ingredients are marked as
 * optional.
 */
export function withApproximateRecipe(
  drink: Recipe,
  stored: StoredMenuRecipe | null
): Recipe {
  if (!stored || !isMenuDescription(drink) || stored.drinkId !== drink.id)
    return drink;
  const { recipe } = stored;
  return {
    ...drink,
    completeness: 'approximate',
    ingredients: recipe.ingredients.map(i => ({
      name: i.name,
      measure: i.amount,
      ...(i.optional ? { note: 'optional' } : {}),
    })),
    steps: [...recipe.steps],
    glass: recipe.glass,
    ice: recipe.ice,
    garnish: recipe.garnish || undefined,
    serving: recipe.serving,
  };
}
