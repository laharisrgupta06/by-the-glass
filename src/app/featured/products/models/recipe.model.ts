/**
 * The source-independent shape every drink is normalised into, whether it comes
 * from TheCocktailDB or the curated collection. Optional fields are left undefined
 * when the source doesn't provide them; never fill them with guesses.
 */
export type DrinkKind = 'cocktail' | 'mocktail' | 'optional';

/** 'own': a recipe someone wrote themselves (My Recipes); never part of the catalogue. */
export type RecipeSource = 'cocktaildb' | 'curated' | 'venue-menu' | 'own';

/**
 * 'recipe' (the default) has what's needed to make the drink. 'menu-description' only
 * lists what a venue menu says goes in it: no quantities or method, so it's never
 * presented, matched or suggested as something you can make. 'approximate' is a venue
 * drink shown with an AI-suggested recipe: its amounts and method are an approximation,
 * not the venue's (only built for the recipe page, never stored as catalogue data).
 */
export type RecipeCompleteness = 'recipe' | 'menu-description' | 'approximate';

export interface RecipeIngredient {
  name: string;
  /** Exactly as the source writes it, e.g. "1 1/2 oz". Undefined if the source has none. */
  measure?: string;
  /** A short qualifier shown beside it, e.g. "optional". */
  note?: string;
}

export interface RecipeTranslation {
  /** BCP 47 code, e.g. "es" or "zh-Hans". */
  lang: string;
  label: string;
  text: string;
}

export interface Recipe {
  id: string;
  source: RecipeSource;
  /** Who the recipe comes from, shown on the details page. */
  credit: string;
  name: string;
  image?: string;
  thumbnail?: string;
  kind?: DrinkKind;
  category?: string;
  glass?: string;
  garnish?: string;
  /** Only curated recipes state a serving count; TheCocktailDB doesn't. */
  servings?: number;
  /** IBA classification, e.g. "Contemporary Classics". */
  iba?: string;
  /** One plain sentence about the drink, built only from data the source provides. */
  description?: string;
  ingredients: RecipeIngredient[];
  /** Primary (English) preparation method. */
  instructions?: string;
  /** The method already split into steps, when the source gives it that way. */
  steps?: string[];
  /**
   * How ice is used, and how to serve it: from an approximate venue recipe, or read
   * from TheCocktailDB's own method when it says so.
   */
  ice?: string;
  serving?: string;
  translations: RecipeTranslation[];
  /**
   * False for list-endpoint entries that only carry a name and photo.
   * Quality checks and ingredient/spirit filters need full details.
   */
  hasDetails: boolean;
  /** Undefined means 'recipe'. */
  completeness?: RecipeCompleteness;
  /** Flavour notes exactly as the source states them, e.g. "sweet", "smoky". */
  flavours?: string[];
  /**
   * Tastes read from the ingredients, e.g. ["sour", "sparkling"], where the source has
   * no flavour notes of its own. Shown as derived, never as the source's words.
   */
  tastes?: string[];
  /**
   * A more specific style than `kind`. A zero-proof cocktail has kind 'mocktail'
   * (it's non-alcoholic) but is labelled as a zero-proof cocktail.
   */
  style?: 'zero-proof';
}

export function isMenuDescription(
  recipe: Pick<Recipe, 'completeness'>
): boolean {
  return recipe.completeness === 'menu-description';
}
