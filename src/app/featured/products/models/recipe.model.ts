/**
 * The source-independent shape every drink is normalised into, whether it comes
 * from TheCocktailDB or the curated collection. Optional fields are left undefined
 * when the source doesn't provide them; never fill them with guesses.
 */
export type DrinkKind = 'cocktail' | 'mocktail' | 'optional';

export type RecipeSource = 'cocktaildb' | 'curated';

export interface RecipeIngredient {
  name: string;
  /** Exactly as the source writes it, e.g. "1 1/2 oz". Undefined if the source has none. */
  measure?: string;
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
  ingredients: RecipeIngredient[];
  /** Primary (English) preparation method. */
  instructions?: string;
  translations: RecipeTranslation[];
  /**
   * False for list-endpoint entries that only carry a name and photo.
   * Quality checks and ingredient/spirit filters need full details.
   */
  hasDetails: boolean;
}
