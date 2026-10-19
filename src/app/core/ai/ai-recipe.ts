/**
 * AI-curated recipes: drinks Gemini creates from a list of ingredients (the person's,
 * for the AI Bartender, or a venue menu's). Shared by the browser and the server so
 * both apply the same checks. Nothing here talks to Gemini.
 *
 * Built to sit beside other recipe origins later (e.g. recipes people write themselves):
 * the recipe shape has no AI-specific fields; `origin` on a saved recipe says where it
 * came from.
 */
import { cleanText } from './ingredient-interpretation';

export type AiRecipeKind = 'cocktail' | 'mocktail';

export interface AiRecipeIngredient {
  name: string;
  /** Approximate, e.g. "45 ml", "2 dashes", "1 wedge". */
  amount: string;
  /**
   * 'given': on the list the recipe was built from (the menu's, or the person's own
   * ingredients), spelled exactly as given. 'extra': added by the AI.
   */
  origin: 'given' | 'extra';
  /** Only an extra can be optional: the drink works without it. */
  optional: boolean;
}

export interface AiRecipe {
  name: string;
  kind: AiRecipeKind;
  description: string;
  ingredients: AiRecipeIngredient[];
  /** In order. */
  steps: string[];
  glass: string;
  /** e.g. "Shake with ice; serve over fresh cubes", or "No ice". */
  ice: string;
  /** Empty when the drink has none. */
  garnish: string;
  serving: string;
}

export const AI_RECIPE_LIMITS = {
  name: 60,
  description: 280,
  ingredients: 14,
  ingredientName: 60,
  amount: 40,
  steps: 10,
  step: 320,
  glass: 60,
  ice: 160,
  garnish: 160,
  serving: 240,
  /** Ingredients a request may give. */
  given: 20,
};

/** Never in a recipe: By the Glass shows no prices anywhere. */
const PRICE =
  /(₹|\$|€|£|¥|\brs\.?\s*\d|\binr\b|\busd\b|\beur\b|\bprices?\b|\bpriced\b|\bmrp\b|\bcosts?\b)/i;

export function mentionsPrice(text: string): boolean {
  return PRICE.test(text);
}

// An amount names a quantity: a number, a fraction, or a bar measure.
const AMOUNT =
  /\d|[½¼¾⅓⅔⅛]|\b(dash(es)?|drops?|pinch(es)?|splash(es)?|top( up)?|fill|sprigs?|lea(f|ves)|wedges?|slices?|twists?|scoops?|handful|half|one|two|three|four|few|bar ?spoons?|teaspoons?|tablespoons?|tsp|tbsp|cups?|to taste|rim|wheel|peel|cubes?|pieces?)\b/i;

// Alcohol, by word. Alcohol-free versions ("Sober gin", "zero-proof rum") and soft drinks
// that borrow a name ("ginger beer") don't count.
const ALCOHOL =
  /\b(gin|vodka|rum|tequila|mezcal|whisk(e)?y|bourbon|scotch|rye whiskey|brandy|cognac|armagnac|calvados|pisco|cacha[cç]a|absinthe|liqueur|schnapps|vermouth|wine|champagne|prosecco|cava|beer|lager|ale|stout|sake|soju|port|sherry|madeira|triple sec|cointreau|grand marnier|campari|aperol|amaretto|kahl[uú]a|baileys|chartreuse|benedictine|drambuie|frangelico|limoncello|sambuca|ouzo|jägermeister|jagermeister|bacardi|camino|dewar'?s|feni|arrack)\b/i;
const ALCOHOL_FREE =
  /\b(sober|non[- ]?alcoholic|alcohol[- ]free|zero[- ]proof|0\.0|virgin|de-?alcoholi[sz]ed)\b|\b(ginger|root|birch) beer\b|\bginger ale\b/i;

/** Whether an ingredient name says it contains alcohol. */
export function isAlcoholic(name: string): boolean {
  return ALCOHOL.test(name) && !ALCOHOL_FREE.test(name);
}

/** Compares ingredient names the way people write them: case, accents, spacing. */
export function sameIngredient(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

function normalize(name: string): string {
  return cleanText(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ');
}

export interface SanitizeOptions {
  /** The ingredients the recipe is built from, as given (menu or person). */
  given: string[];
  /** Menu recipes must use every listed ingredient; the AI Bartender at least one. */
  requireAllGiven: boolean;
  /** When set, the recipe must be this kind. */
  kind?: AiRecipeKind;
  /**
   * Mocktails may contain no alcohol. 'all' checks every ingredient (the person may own
   * gin but asked for a mocktail); 'extras' only what the AI added (a menu's own
   * zero-proof ingredients are trusted).
   */
  alcoholCheck?: 'all' | 'extras';
  /**
   * Rejects "No ice" when the method uses ice. On by default; off when reopening a
   * recipe someone saved, so a later, stricter check never hides it.
   */
  strictIce?: boolean;
}

export type SanitizeResult =
  | { ok: true; recipe: AiRecipe }
  | { ok: false; reason: string };

/**
 * Turns a model answer into a recipe we can show, or says why it can't be used.
 * Nothing is repaired into something new: given ingredients keep their exact
 * spelling, anything else is an extra, and a recipe that drops a required ingredient,
 * mixes alcohol into a mocktail, or mentions a price is rejected.
 */
export function sanitizeAiRecipe(
  raw: unknown,
  options: SanitizeOptions
): SanitizeResult {
  const fail = (reason: string): SanitizeResult => ({ ok: false, reason });
  if (!raw || typeof raw !== 'object') return fail('not-an-object');
  const data = raw as Record<string, unknown>;
  const L = AI_RECIPE_LIMITS;

  const text = (key: string, max: number, required = true) => {
    const value = cleanText(data[key]);
    if (required && !value) return null;
    return value.length > max ? null : value;
  };
  const name = text('name', L.name);
  const description = text('description', L.description);
  const glass = text('glass', L.glass);
  const ice = text('ice', L.ice);
  const garnish = text('garnish', L.garnish, false);
  const serving = text('serving', L.serving);
  if (
    name === null ||
    description === null ||
    glass === null ||
    ice === null ||
    garnish === null ||
    serving === null
  )
    return fail('missing-or-long-field');

  const kind = data['kind'];
  if (kind !== 'cocktail' && kind !== 'mocktail') return fail('bad-kind');
  if (options.kind && kind !== options.kind) return fail('wrong-kind');

  const rawIngredients = Array.isArray(data['ingredients'])
    ? data['ingredients']
    : [];
  if (!rawIngredients.length || rawIngredients.length > L.ingredients)
    return fail('ingredient-count');
  const ingredients: AiRecipeIngredient[] = [];
  for (const item of rawIngredients) {
    if (!item || typeof item !== 'object') return fail('bad-ingredient');
    const entry = item as Record<string, unknown>;
    const ingredientName = cleanText(entry['name']);
    const amount = cleanText(entry['amount']);
    if (!ingredientName || ingredientName.length > L.ingredientName)
      return fail('bad-ingredient-name');
    if (!amount || amount.length > L.amount || !AMOUNT.test(amount))
      return fail('bad-amount');
    if (ingredients.some(i => sameIngredient(i.name, ingredientName))) continue;
    const given = options.given.find(g => sameIngredient(g, ingredientName));
    ingredients.push({
      // A given ingredient keeps the exact spelling it was given in.
      name: given ?? ingredientName,
      amount,
      origin: given ? 'given' : 'extra',
      optional: !given && entry['optional'] === true,
    });
  }

  const usesGiven = (g: string) =>
    ingredients.some(i => i.origin === 'given' && sameIngredient(i.name, g));
  if (options.requireAllGiven && !options.given.every(usesGiven))
    return fail('dropped-a-given-ingredient');
  if (!ingredients.some(i => i.origin === 'given'))
    return fail('uses-none-of-the-given-ingredients');

  const rawSteps = Array.isArray(data['steps']) ? data['steps'] : [];
  const steps = rawSteps.map(step => cleanText(step)).filter(Boolean);
  if (!steps.length || steps.length > L.steps) return fail('step-count');
  if (steps.some(step => step.length > L.step)) return fail('long-step');
  // "No ice" next to "shake with ice" reads as a contradiction.
  if (
    options.strictIce !== false &&
    /^\s*no ice\b/i.test(ice) &&
    steps.some(step => /\bice\b(?![- ]?cream)/i.test(step))
  )
    return fail('ice-contradicts-method');

  if (kind === 'mocktail' && options.alcoholCheck) {
    const checked =
      options.alcoholCheck === 'all'
        ? ingredients
        : ingredients.filter(i => i.origin === 'extra');
    if (checked.some(i => isAlcoholic(i.name)))
      return fail('alcohol-in-mocktail');
  }

  const recipe: AiRecipe = {
    name,
    kind,
    description,
    ingredients,
    steps,
    glass,
    ice,
    garnish,
    serving,
  };
  const allText = [
    name,
    description,
    glass,
    ice,
    garnish,
    serving,
    ...steps,
    ...ingredients.flatMap(i => [i.name, i.amount]),
  ].join('\n');
  if (mentionsPrice(allText)) return fail('mentions-a-price');
  return { ok: true, recipe };
}

/**
 * The JSON schema Gemini answers with. Small and fixed, like the ingredient one:
 * which names are allowed travels in the prompt, and sanitizeAiRecipe checks them.
 */
export function aiRecipeSchema(): Record<string, unknown> {
  const L = AI_RECIPE_LIMITS;
  return {
    type: 'object',
    properties: {
      name: { type: 'string' },
      kind: { type: 'string', enum: ['cocktail', 'mocktail'] },
      description: { type: 'string' },
      ingredients: {
        type: 'array',
        minItems: 1,
        maxItems: L.ingredients,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            amount: { type: 'string' },
            optional: { type: 'boolean' },
          },
          required: ['name', 'amount', 'optional'],
        },
      },
      steps: {
        type: 'array',
        minItems: 1,
        maxItems: L.steps,
        items: { type: 'string' },
      },
      glass: { type: 'string' },
      ice: { type: 'string' },
      garnish: { type: 'string' },
      serving: { type: 'string' },
    },
    required: [
      'name',
      'kind',
      'description',
      'ingredients',
      'steps',
      'glass',
      'ice',
      'garnish',
      'serving',
    ],
  };
}

/**
 * A stable id for a recipe's content, so saving the same recipe twice keeps one copy:
 * "ai-" and 16 hex digits (two 32-bit FNV-1a hashes).
 */
export function aiRecipeId(recipe: AiRecipe): string {
  const canonical = JSON.stringify([
    normalize(recipe.name),
    recipe.kind,
    recipe.ingredients.map(i => [normalize(i.name), normalize(i.amount)]),
    recipe.steps.map(normalize),
  ]);
  const fnv = (seed: number) => {
    let hash = seed;
    for (let i = 0; i < canonical.length; i++) {
      hash ^= canonical.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  };
  return `ai-${fnv(0x811c9dc5)}${fnv(0x01000193)}`;
}

// ---- The AI Bartender (What Can I Make?) ----

export type BartenderType = 'both' | AiRecipeKind;

export interface BartenderRequest {
  /** The person's ingredients, as they named them. */
  ingredients: string[];
  type: BartenderType;
  /** Taste labels, e.g. ["Sour"]. */
  tastes: string[];
}

export interface BartenderAnswer {
  recipe: AiRecipe;
  /** The ingredients it was created from, as sent. */
  basedOn: string[];
}

export const BARTENDER_PATHS = {
  create: '/api/bartender/create',
};

/** Checks an answer from our server again in the browser before showing it. */
export function checkBartenderAnswer(
  raw: unknown,
  request: BartenderRequest
): AiRecipe | null {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  const result = sanitizeAiRecipe(data['recipe'], {
    given: request.ingredients,
    requireAllGiven: false,
    kind: request.type === 'both' ? undefined : request.type,
    alcoholCheck: 'all',
  });
  return result.ok ? result.recipe : null;
}

// ---- Venue-menu drinks ----

/** A recipe created for a venue-menu drink, kept apart from the menu's own listing. */
export interface StoredMenuRecipe {
  drinkId: string;
  drinkName: string;
  /** The menu's ingredients when it was created, to spot a changed listing. */
  menuIngredients: string[];
  recipe: AiRecipe;
  model: string;
  createdAt: string;
}

export interface MenuIllustration {
  /** Served by our API; an AI-generated illustration, never a photograph. */
  url: string;
  model: string;
  createdAt: string;
}

export interface MenuExtras {
  recipe: StoredMenuRecipe | null;
  illustration: MenuIllustration | null;
  /** Whether a recipe can be created now (the server has a Gemini key). */
  canCreateRecipe: boolean;
}

export const MENU_PATHS = {
  index: '/api/venue-menu',
  extras: (id: string) => `/api/venue-menu/${encodeURIComponent(id)}/extras`,
  recipe: (id: string) => `/api/venue-menu/${encodeURIComponent(id)}/recipe`,
  illustration: (id: string) =>
    `/api/venue-menu/${encodeURIComponent(id)}/illustration`,
};
