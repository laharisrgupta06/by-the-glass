import { Recipe } from '../models/recipe.model';

/**
 * By the Glass's own collection, merged with TheCocktailDB results by the repository.
 * Use it for legitimate drinks the API is missing, such as contemporary café and bar
 * drinks and Indian drinking culture.
 *
 * Rules for every entry:
 * - source: 'curated', with an id prefixed "bg-" so it can't collide with API ids
 * - credit names where the recipe comes from
 * - only real, tested recipes: no generated or trend-bait drinks
 * - never guess measurements, servings, glassware or garnish; leave them out instead
 *
 * Intentionally empty until the curated dataset is ready.
 */
export const CURATED_RECIPES: Recipe[] = [];
