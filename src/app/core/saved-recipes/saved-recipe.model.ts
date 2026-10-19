import { AiRecipe, sanitizeAiRecipe } from '../ai/ai-recipe';

/**
 * Where a saved recipe came from. Only 'ai-curated' exists today; recipes people write
 * themselves can be added as another origin with the same recipe shape.
 */
export type SavedRecipeOrigin = 'ai-curated';

/**
 * A complete recipe saved to Personal, stored as
 * users/{userId}/savedRecipes/{id}. The id comes from the recipe's content
 * (aiRecipeId), so saving the same recipe twice keeps one copy. Kept apart from
 * favorites, which only point at catalogue and menu drinks.
 */
export interface SavedRecipe {
  id: string;
  origin: SavedRecipeOrigin;
  recipe: AiRecipe;
  /** The ingredients it was created from, as the person named them. */
  basedOn: string[];
  createdAt: Date | null;
}

export const SAVED_RECIPE_SCHEMA_VERSION = 1;

/** A stored document, checked like a fresh AI answer; anything off is skipped. */
export function readSavedRecipe(
  id: string,
  data: Record<string, unknown>
): SavedRecipe | null {
  if (data['origin'] !== 'ai-curated') return null;
  const basedOn = Array.isArray(data['basedOn'])
    ? data['basedOn'].filter((b): b is string => typeof b === 'string')
    : [];
  const result = sanitizeAiRecipe(data['recipe'], {
    given: basedOn,
    requireAllGiven: false,
    strictIce: false,
  });
  if (!result.ok) return null;
  const createdAt = data['createdAt'] as { toDate?: () => Date } | undefined;
  return {
    id,
    origin: 'ai-curated',
    recipe: result.recipe,
    basedOn,
    createdAt: createdAt?.toDate?.() ?? null,
  };
}
