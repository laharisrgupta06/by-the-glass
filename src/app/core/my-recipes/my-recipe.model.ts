import { mentionsPrice } from '../ai/ai-recipe';
import type { Recipe } from 'src/app/featured/products/models/recipe.model';

/**
 * Recipes people write themselves, stored as users/{userId}/myRecipes/{id}: private,
 * editable, and separate from favorites (which point at catalogue drinks) and from
 * saved AI recipes. Nothing here involves AI.
 */

export const RECIPE_UNITS = [
  'ml',
  'cl',
  'oz',
  'tsp',
  'tbsp',
  'bar spoon',
  'dash',
  'drop',
  'splash',
  'part',
  'cup',
  'piece',
  'slice',
  'wedge',
  'sprig',
  'leaf',
  'pinch',
  'scoop',
  'top up',
  'to taste',
] as const;
export type RecipeUnit = (typeof RECIPE_UNITS)[number];

/** Units that stand on their own: "Top up with soda", "Salt to taste". */
export const UNITS_WITHOUT_QUANTITY: RecipeUnit[] = ['top up', 'to taste'];

const PLURALS: Partial<Record<RecipeUnit, string>> = {
  'bar spoon': 'bar spoons',
  dash: 'dashes',
  drop: 'drops',
  splash: 'splashes',
  part: 'parts',
  cup: 'cups',
  piece: 'pieces',
  slice: 'slices',
  wedge: 'wedges',
  sprig: 'sprigs',
  leaf: 'leaves',
  pinch: 'pinches',
  scoop: 'scoops',
};

export interface MyRecipeIngredient {
  name: string;
  /** e.g. "45", "1 1/2", "2-3"; empty for "top up" and "to taste". */
  quantity: string;
  unit: RecipeUnit;
}

export interface MyRecipeDraft {
  name: string;
  description: string;
  kind: 'cocktail' | 'mocktail';
  ingredients: MyRecipeIngredient[];
  /** In order. */
  steps: string[];
  glass: string;
  ice: string;
  garnish: string;
}

/**
 * A photo the person added, kept in Cloud Storage (never inside the Firestore
 * document): where it is, and a URL to show it.
 */
export interface MyRecipeImage {
  /**
   * INLINE_PHOTO_PATH for a photo kept in the recipe document itself (url is then a
   * data: URL). Older photos in Cloud Storage have their object path here:
   * users/{userId}/myRecipes/{recipeId}/{file}.
   */
  path: string;
  url: string;
}

export interface MyRecipe extends MyRecipeDraft {
  id: string;
  image: MyRecipeImage | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/** What happens to a recipe's photo when it's saved. */
export type ImageChange =
  | { kind: 'keep' }
  | { kind: 'set'; blob: Blob; contentType: string }
  | { kind: 'remove' };

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
/** Before it's shrunk in the browser; what's stored is far smaller. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/**
 * Photos are stored inside the recipe's own Firestore document, as a data: URL, so
 * they need no Cloud Storage (and no paid plan). A document can hold at most 1 MiB, so
 * the shrunk photo is kept to 150 KB (about 200 KB as base64); firestore.rules allows
 * up to INLINE_PHOTO_MAX_URL_LENGTH characters.
 */
export const INLINE_PHOTO_PATH = 'inline';
export const MAX_STORED_PHOTO_BYTES = 150 * 1024;
export const INLINE_PHOTO_MAX_URL_LENGTH = 300_000;

/** Why a chosen file can't be used as a recipe photo, or null. */
export function photoProblem(file: {
  type: string;
  size: number;
}): string | null {
  if (!PHOTO_TYPES.includes(file.type))
    return 'Choose a JPEG, PNG or WebP photo.';
  if (file.size > MAX_PHOTO_BYTES) return 'Choose a photo under 10 MB.';
  if (file.size === 0) return 'That file is empty.';
  return null;
}

export const MY_RECIPE_LIMITS = {
  name: 60,
  description: 280,
  ingredients: 20,
  ingredientName: 60,
  quantity: 12,
  steps: 15,
  step: 400,
  glass: 60,
  ice: 120,
  garnish: 120,
};

export const MY_RECIPE_SCHEMA_VERSION = 1;

/** "45", "1.5", "1/2", "1 1/2", "2-3"; never zero. */
const QUANTITY =
  /^(\d+(\.\d+)?|\d+\/\d+|\d+ \d+\/\d+)(\s*[-–]\s*(\d+(\.\d+)?|\d+\/\d+))?$/;

export function quantityProblem(
  quantity: string,
  unit: RecipeUnit
): string | null {
  const value = quantity.trim();
  if (UNITS_WITHOUT_QUANTITY.includes(unit))
    return value ? `Leave the amount empty for “${unit}”.` : null;
  if (!value) return 'Add an amount, e.g. 45 or 1 1/2.';
  if (value.length > MY_RECIPE_LIMITS.quantity || !QUANTITY.test(value))
    return 'Use a number, fraction or range, e.g. 45, 1/2, 1 1/2 or 2-3.';
  if (/^0+(\.0+)?$/.test(value)) return 'The amount can’t be zero.';
  return null;
}

/** "1 1/2 oz", "2 dashes", "Top up". */
export function formatMeasure({ quantity, unit }: MyRecipeIngredient): string {
  if (UNITS_WITHOUT_QUANTITY.includes(unit))
    return unit.charAt(0).toUpperCase() + unit.slice(1);
  const plural =
    Number(quantity.trim().split(/[\s/–-]/)[0]) > 1 || /[-–]/.test(quantity);
  return `${quantity.trim()} ${plural ? PLURALS[unit] ?? unit : unit}`;
}

/** Steps from a method typed one step per line; leading numbering is dropped. */
export function stepsFromText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*(\d+[.)]|[-*•])\s*/, '').trim())
    .filter(Boolean);
}

export type DraftProblems = Partial<
  Record<
    | 'name'
    | 'description'
    | 'kind'
    | 'ingredients'
    | 'steps'
    | 'glass'
    | 'ice'
    | 'garnish',
    string
  >
> & { ingredient?: Record<number, { name?: string; quantity?: string }> };

/**
 * Everything wrong with a draft, in words a person can act on. Empty means it can be
 * saved. Used by the form and checked again before anything is stored.
 */
export function draftProblems(draft: MyRecipeDraft): DraftProblems {
  const L = MY_RECIPE_LIMITS;
  const problems: DraftProblems = {};
  const text = (
    key: 'name' | 'description' | 'glass' | 'ice' | 'garnish',
    label: string,
    max: number,
    required: boolean
  ) => {
    const value = draft[key].trim();
    if (required && !value) problems[key] = `Add ${label}.`;
    else if (value.length > max)
      problems[key] = `Keep ${label} under ${max} characters.`;
    else if (mentionsPrice(value))
      problems[key] = 'Leave prices out: By the Glass shows none.';
  };
  text('name', 'a name', L.name, true);
  text('description', 'a short description', L.description, true);
  text('glass', 'the glass', L.glass, false);
  text('ice', 'the ice note', L.ice, false);
  text('garnish', 'the garnish', L.garnish, false);
  if (draft.kind !== 'cocktail' && draft.kind !== 'mocktail')
    problems.kind = 'Choose cocktail or mocktail.';

  if (!draft.ingredients.length)
    problems.ingredients = 'Add at least one ingredient.';
  else if (draft.ingredients.length > L.ingredients)
    problems.ingredients = `Use at most ${L.ingredients} ingredients.`;
  const ingredient: NonNullable<DraftProblems['ingredient']> = {};
  draft.ingredients.forEach((item, i) => {
    const issue: { name?: string; quantity?: string } = {};
    const name = item.name.trim();
    if (!name) issue.name = 'Name the ingredient.';
    else if (name.length > L.ingredientName)
      issue.name = `Keep it under ${L.ingredientName} characters.`;
    else if (mentionsPrice(name)) issue.name = 'Leave prices out.';
    if (!RECIPE_UNITS.includes(item.unit)) issue.quantity = 'Choose a unit.';
    else {
      const quantity = quantityProblem(item.quantity, item.unit);
      if (quantity) issue.quantity = quantity;
    }
    if (issue.name || issue.quantity) ingredient[i] = issue;
  });
  if (Object.keys(ingredient).length) problems.ingredient = ingredient;

  if (!draft.steps.length)
    problems.steps = 'Add the method: one step per line.';
  else if (draft.steps.length > L.steps)
    problems.steps = `Use at most ${L.steps} steps.`;
  else if (draft.steps.some(step => step.length > L.step))
    problems.steps = `Keep each step under ${L.step} characters.`;
  else if (draft.steps.some(mentionsPrice))
    problems.steps = 'Leave prices out: By the Glass shows none.';
  return problems;
}

export function isSaveable(draft: MyRecipeDraft): boolean {
  return Object.keys(draftProblems(draft)).length === 0;
}

/** A stored document, checked; anything malformed is skipped rather than guessed at. */
export function readMyRecipe(
  id: string,
  data: Record<string, unknown>
): MyRecipe | null {
  const str = (key: string) =>
    typeof data[key] === 'string' ? (data[key] as string) : '';
  const ingredients = Array.isArray(data['ingredients'])
    ? (data['ingredients'] as Record<string, unknown>[]).map(i => ({
        name: typeof i?.['name'] === 'string' ? (i['name'] as string) : '',
        quantity:
          typeof i?.['quantity'] === 'string' ? (i['quantity'] as string) : '',
        unit: i?.['unit'] as RecipeUnit,
      }))
    : [];
  const steps = Array.isArray(data['steps'])
    ? data['steps'].filter((s): s is string => typeof s === 'string')
    : [];
  const draft: MyRecipeDraft = {
    name: str('name'),
    description: str('description'),
    kind: data['kind'] as MyRecipeDraft['kind'],
    ingredients,
    steps,
    glass: str('glass'),
    ice: str('ice'),
    garnish: str('garnish'),
  };
  if (!isSaveable(draft)) return null;
  const date = (key: string) =>
    (data[key] as { toDate?: () => Date } | undefined)?.toDate?.() ?? null;
  const rawImage = data['image'] as Partial<MyRecipeImage> | undefined;
  const image =
    typeof rawImage?.path === 'string' && typeof rawImage?.url === 'string'
      ? { path: rawImage.path, url: rawImage.url }
      : null;
  return {
    id,
    ...draft,
    image,
    createdAt: date('createdAt'),
    updatedAt: date('updatedAt'),
  };
}

/** Shown with the same components as every other recipe page. */
export function toDisplayRecipe(
  recipe: MyRecipeDraft & { id?: string; image?: { url: string } | null }
): Recipe {
  return {
    id: recipe.id ?? 'preview',
    source: 'own',
    credit: 'you',
    name: recipe.name.trim() || 'Untitled recipe',
    image: recipe.image?.url,
    thumbnail: recipe.image?.url,
    kind: recipe.kind,
    description: recipe.description.trim() || undefined,
    glass: recipe.glass.trim() || undefined,
    ice: recipe.ice.trim() || undefined,
    garnish: recipe.garnish.trim() || undefined,
    ingredients: recipe.ingredients
      .filter(i => i.name.trim())
      .map(i => ({ name: i.name.trim(), measure: formatMeasure(i) })),
    steps: recipe.steps,
    instructions: recipe.steps.join(' '),
    translations: [],
    hasDetails: true,
  };
}

/** Ids are made in the browser: 20 letters and digits, as Firestore's own are. */
export function newRecipeId(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}
