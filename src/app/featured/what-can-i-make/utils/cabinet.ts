import { cleanTerm } from 'src/app/core/ai/ingredient-interpretation';
import { curate } from '../../products/data/recipe-quality';
import {
  IngredientRules,
  ingredientKey,
} from '../../products/data/ingredient-rules';
import { Recipe, RecipeIngredient } from '../../products/models/recipe.model';
import {
  DrinkType,
  byName,
  matchesType,
} from '../../products/utils/drink-filters';
import {
  IngredientCategory,
  OTHER_CATEGORY,
} from '../data/ingredient-categories';
import { Taste, TasteDefinition } from '../data/taste-signals';

/** An ingredient someone can pick: one per key, labelled the way most recipes write it. */
export interface IngredientOption {
  key: string;
  label: string;
  /** How many of the drinks we check use it. */
  count: number;
}

/** A rule that let one ingredient stand in for another, e.g. a lime for lime juice. */
export interface Stand {
  have: string;
  need: string;
}

export interface CabinetMatch {
  recipe: Recipe;
  /** Ingredients still needed, as the recipe names them. */
  missing: { key: string; name: string }[];
  /** How many of the recipe's ingredients the cabinet covers. */
  covered: number;
  stands: Stand[];
}

export interface CabinetQuery {
  have: string[];
  type: DrinkType;
  tastes: Taste[];
}

export interface CabinetResults {
  /** Everything the recipe needs is covered. */
  ready: CabinetMatch[];
  /**
   * Uses at least one cabinet ingredient but needs one or more others, listed in
   * `missing`. Fewest missing first.
   */
  almost: CabinetMatch[];
  /** Complete recipes of the chosen type that were checked. */
  checked: number;
}

interface CompiledRules {
  basics: Set<string>;
  covers: Map<string, Set<string>>;
}

const compiled = new WeakMap<IngredientRules, CompiledRules>();

/** Rules are written with readable names; compare them by key. */
function compile(rules: IngredientRules): CompiledRules {
  let result = compiled.get(rules);
  if (!result) {
    result = {
      basics: new Set(rules.basics.map(ingredientKey)),
      covers: new Map(
        Object.entries(rules.covers).map(([have, needs]) => [
          ingredientKey(have),
          new Set(needs.map(ingredientKey)),
        ])
      ),
    };
    compiled.set(rules, result);
  }
  return result;
}

/** Only drinks we'd show on the Drinks page, with the ingredient data to judge them. */
export function makeableRecipes(recipes: Recipe[]): Recipe[] {
  const usable = recipes
    .filter(r => r?.hasDetails && Array.isArray(r.ingredients))
    // Blank ingredient rows would trip the quality checks; they carry nothing anyway.
    .map(r =>
      r.ingredients.every(hasName)
        ? r
        : { ...r, ingredients: r.ingredients.filter(hasName) }
    );
  return curate(usable).recipes.filter(r => r.ingredients.length > 0);
}

function hasName(ingredient: RecipeIngredient | null | undefined): boolean {
  return typeof ingredient?.name === 'string' && ingredient.name.trim() !== '';
}

/** Distinct ingredients of a recipe, by key, skipping blank names. */
function ingredientsOf(
  recipe: Recipe
): { key: string; name: string; measure?: string }[] {
  const seen = new Set<string>();
  const result: { key: string; name: string; measure?: string }[] = [];
  for (const ingredient of recipe.ingredients ?? []) {
    const key = ingredientKey(ingredient?.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push({
      key,
      name: ingredient.name.trim(),
      measure: ingredient.measure,
    });
  }
  return result;
}

/** Every ingredient used by a makeable drink, most used first. Basics are left out. */
export function buildIngredientIndex(
  recipes: Recipe[],
  rules: IngredientRules
): IngredientOption[] {
  const { basics } = compile(rules);
  const counts = new Map<
    string,
    { count: number; spellings: Map<string, number> }
  >();
  for (const recipe of makeableRecipes(recipes)) {
    for (const { key, name } of ingredientsOf(recipe)) {
      if (basics.has(key)) continue;
      const entry = counts.get(key) ?? { count: 0, spellings: new Map() };
      entry.count++;
      entry.spellings.set(name, (entry.spellings.get(name) ?? 0) + 1);
      counts.set(key, entry);
    }
  }
  return [...counts.entries()]
    .map(([key, { count, spellings }]) => ({
      key,
      label: preferredSpelling(spellings),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

// "Lime juice" over "Lime Juice", to match the rest of the site; then the most common spelling.
function preferredSpelling(spellings: Map<string, number>): string {
  const [label] = [...spellings.entries()].sort(
    ([a, countA], [b, countB]) =>
      Number(isSentenceCase(b)) - Number(isSentenceCase(a)) || countB - countA
  )[0];
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function isSentenceCase(name: string): boolean {
  return name.slice(1) === name.slice(1).toLowerCase();
}

/** "limes" → "lime", "cherries" → "cherry", "tomatoes" → "tomato", tried in that order. */
function singulars(key: string): string[] {
  const forms: string[] = [];
  if (key.endsWith('ies')) forms.push(key.slice(0, -3) + 'y');
  if (key.endsWith('s')) forms.push(key.slice(0, -1));
  if (key.endsWith('es')) forms.push(key.slice(0, -2));
  return forms;
}

function wordStarts(key: string, query: string): boolean {
  return key.startsWith(query) || key.includes(' ' + query);
}

/**
 * Ingredients matching what's been typed: exact first, then names starting with it,
 * then names with a word starting with it ("juice" finds "Lime juice"). Spelling,
 * case, accents and a trailing plural don't matter.
 */
export function suggestIngredients(
  index: IngredientOption[],
  text: string,
  exclude: string[] = [],
  limit = 8
): IngredientOption[] {
  const query = ingredientKey(text);
  if (!query) return [];
  const skip = new Set(exclude);
  const search = (q: string) =>
    index
      .filter(option => !skip.has(option.key) && wordStarts(option.key, q))
      .map(option => ({
        option,
        rank: option.key === q ? 0 : option.key.startsWith(q) ? 1 : 2,
      }))
      .sort((a, b) => a.rank - b.rank || b.option.count - a.option.count)
      .map(({ option }) => option);
  let found = search(query);
  for (const form of singulars(query)) {
    if (found.length) break;
    found = search(form);
  }
  return found.slice(0, limit);
}

/** Adds an ingredient once; picking it again changes nothing. */
export function addIngredient(have: string[], key: string): string[] {
  const k = ingredientKey(key);
  return !k || have.includes(k) ? have : [...have, k];
}

export function removeIngredient(have: string[], key: string): string[] {
  return have.filter(k => k !== key);
}

/** Which of the cabinet's ingredients covers this one, if any. */
function coveredBy(
  ingredient: { key: string; measure?: string },
  have: Set<string>,
  rules: CompiledRules
): string | undefined {
  if (have.has(ingredient.key)) return ingredient.key;
  for (const key of have)
    if (rules.covers.get(key)?.has(ingredient.key)) return key;
  // The source often lists "Lime" with a measure like "Juice of 1", which bottled lime juice covers.
  const juice = `${ingredient.key} juice`;
  if (/^\s*juice of/i.test(ingredient.measure ?? '') && have.has(juice))
    return juice;
  return undefined;
}

export function hasTaste(recipe: Recipe, taste: TasteDefinition): boolean {
  // The source's own flavour notes (venue-menu drinks) beat reading ingredients.
  if (recipe.flavours?.length)
    return recipe.flavours.some(note => note.trim().toLowerCase() === taste.id);
  const exact = new Set(taste.ingredients.map(ingredientKey));
  const words = (taste.words ?? []).map(
    word => new RegExp(`(^| )${ingredientKey(word)}( |$)`)
  );
  return ingredientsOf(recipe).some(
    ({ key }) => exact.has(key) || words.some(word => word.test(key))
  );
}

/**
 * Sorts drinks into ones the cabinet covers completely and ones that use something
 * from it but need more. Low-quality recipes are left out, as on the Drinks page.
 * Nothing is substituted except through the explicit rules: a similar ingredient
 * never counts as one the person has.
 */
export function matchCabinet(
  recipes: Recipe[],
  { have, type, tastes }: CabinetQuery,
  rules: IngredientRules,
  tasteDefinitions: TasteDefinition[] = []
): CabinetResults {
  const compiledRules = compile(rules);
  const cabinet = new Set(have.map(ingredientKey).filter(Boolean));
  const wanted = tasteDefinitions.filter(t => tastes.includes(t.id));
  const ready: CabinetMatch[] = [];
  const almost: CabinetMatch[] = [];
  let checked = 0;
  if (!cabinet.size) return { ready, almost, checked };

  for (const recipe of makeableRecipes(recipes)) {
    if (!matchesType(recipe, type)) continue;
    // Venue drinks are part of the catalogue: matched and counted like any other.
    checked++;
    if (!wanted.every(taste => hasTaste(recipe, taste))) continue;

    const missing: CabinetMatch['missing'] = [];
    const stands: Stand[] = [];
    let covered = 0;
    for (const ingredient of ingredientsOf(recipe)) {
      if (compiledRules.basics.has(ingredient.key)) continue;
      const by = coveredBy(ingredient, cabinet, compiledRules);
      if (!by) {
        missing.push({ key: ingredient.key, name: ingredient.name });
        continue;
      }
      covered++;
      if (by !== ingredient.key)
        stands.push({ have: by, need: ingredient.key });
    }
    // A drink made only of basics, or one that uses nothing from the cabinet, isn't a match.
    if (!covered) continue;
    const match = { recipe, missing, covered, stands };
    (missing.length ? almost : ready).push(match);
  }

  const order = (a: CabinetMatch, b: CabinetMatch) =>
    b.covered - a.covered || byName(a.recipe, b.recipe);
  // Closest first: fewest ingredients still to get.
  const closest = (a: CabinetMatch, b: CabinetMatch) =>
    a.missing.length - b.missing.length || order(a, b);
  return {
    ready: ready.sort(order),
    almost: almost.sort(closest),
    checked,
  };
}

/**
 * The missing ingredient that would finish the most "almost there" drinks. Only drinks
 * one ingredient short count: for the others, one more wouldn't finish them.
 */
export function bestNextIngredient(
  almost: CabinetMatch[]
): { key: string; count: number } | undefined {
  const counts = new Map<string, number>();
  for (const { missing } of almost)
    if (missing.length === 1)
      counts.set(missing[0].key, (counts.get(missing[0].key) ?? 0) + 1);
  let best: { key: string; count: number } | undefined;
  for (const [key, count] of counts)
    if (!best || count > best.count) best = { key, count };
  return best;
}

/** What's in the URL: ?i=gin&i=lime+juice&type=cocktail&taste=sour */
export interface CabinetParams {
  have: string[];
  type: DrinkType;
  tastes: Taste[];
}

export const MAX_INGREDIENTS = 20;

export function parseCabinetParams(
  params: { getAll(name: string): string[]; get(name: string): string | null },
  tasteIds: Taste[]
): CabinetParams {
  const have = params
    .getAll('i')
    .reduce(addIngredient, [] as string[])
    .slice(0, MAX_INGREDIENTS);
  const type = params.get('type');
  const tastes = (params.get('taste') ?? '')
    .split(',')
    .filter((t): t is Taste => tasteIds.includes(t as Taste));
  return {
    have,
    type: type === 'cocktail' || type === 'mocktail' ? type : 'both',
    tastes: [...new Set(tastes)],
  };
}

/**
 * Ingredients as written in the URL, by key. Ingredients our drinks don't use (e.g.
 * "Mogu Mogu") have no label of ours, so they're shown exactly as the person typed them.
 */
export function typedLabels(params: {
  getAll(name: string): string[];
}): Map<string, string> {
  const labels = new Map<string, string>();
  for (const raw of params.getAll('i')) {
    const label = cleanTerm(raw);
    const key = ingredientKey(raw);
    if (label && key && !labels.has(key)) labels.set(key, label);
  }
  return labels;
}

/** A category with the ingredients placed in it. */
export interface IngredientShelf {
  category: IngredientCategory;
  options: IngredientOption[];
}

/**
 * Puts every ingredient on exactly one shelf: by name first, then by word in
 * `wordPriority` order, otherwise "Everything else". Empty shelves are left out, so
 * only categories the data actually has are shown. Ingredients read A–Z.
 */
export function shelveIngredients(
  index: IngredientOption[],
  categories: IngredientCategory[],
  other: IngredientCategory = OTHER_CATEGORY
): IngredientShelf[] {
  const byName = new Map<string, IngredientCategory>();
  for (const category of categories)
    for (const name of category.ingredients ?? [])
      byName.set(ingredientKey(name), category);
  const byWord = categories
    .filter(c => c.words?.length)
    .sort((a, b) => (a.wordPriority ?? 0) - (b.wordPriority ?? 0))
    .map(category => ({
      category,
      words: category.words!.map(
        word => new RegExp(`(^| )${ingredientKey(word)}( |$)`)
      ),
    }));

  const shelves = new Map<IngredientCategory, IngredientOption[]>();
  for (const option of index) {
    const category =
      byName.get(option.key) ??
      byWord.find(({ words }) => words.some(w => w.test(option.key)))
        ?.category ??
      other;
    shelves.set(category, [...(shelves.get(category) ?? []), option]);
  }
  return [...categories, other]
    .filter(category => shelves.has(category))
    .map(category => ({
      category,
      options: shelves
        .get(category)!
        .sort((a, b) => a.label.localeCompare(b.label)),
    }));
}
