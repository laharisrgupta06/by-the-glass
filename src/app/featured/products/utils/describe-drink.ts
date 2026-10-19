import { isAlcoholic } from 'src/app/core/ai/ai-recipe';
import { Recipe } from '../models/recipe.model';

/**
 * One plain sentence about a drink, built only from what its source says: its type,
 * ingredients, glass, and (for venue drinks) the menu's own flavour notes. Nothing is
 * looked up or generated, so the same drink always gets the same sentence, and nothing
 * the source doesn't state is claimed.
 */

// Not worth naming in a one-line description.
const BASICS =
  /^(ice|ice cubes|crushed ice|cracked ice|water|cold water|hot water)$/i;

// Tastes and textures an ingredient clearly carries, checked in this order.
const TRAITS: [string, RegExp][] = [
  [
    'creamy',
    /\b(cream|milk|yoghurt|yogurt|ice-cream|ice cream|eggnog|condensed milk|coconut milk)\b/i,
  ],
  [
    'sparkling',
    /\b(soda|tonic|ginger ale|ginger beer|cola|coca-cola|7-up|sprite|champagne|prosecco|lemonade|club soda|carbonated|sparkling)\b/i,
  ],
  ['sour', /\b(lemon|lime|grapefruit|sour mix|sweet and sour)\b/i],
  [
    'sweet',
    /\b(sugar|syrup|honey|grenadine|liqueur|schnapps|cordial|cream of coconut)\b/i,
  ],
  ['bitter', /\b(campari|aperol|amaro|bitter lemon)\b/i],
  ['spicy', /\b(chili|chilli|pepper|tabasco|hot sauce|cayenne|ginger)\b/i],
];

// What to call the drink, by TheCocktailDB category; others fall back to its kind.
const CATEGORY_NOUNS: Record<string, string> = {
  Shot: 'shot',
  'Punch / Party Drink': 'punch',
  Shake: 'shake',
  Cocoa: 'cocoa drink',
  Beer: 'beer drink',
  'Homemade Liqueur': 'homemade liqueur',
  'Soft Drink': 'soft drink',
};

// Brands and proper adjectives keep their capitals; everything else reads in lower case.
const PROPER_NAMES = [
  'Coca-Cola',
  'Coke',
  'Pepsi',
  'Sprite',
  '7-Up',
  'Fresca',
  'Schweppes',
  'Red Bull',
  'Mountain Dew',
  'Dr. Pepper',
  'Kool-Aid',
  'Orangina',
  'Grand Marnier',
  'Baileys',
  "Bailey's",
  'Kahlua',
  'Campari',
  'Aperol',
  'Cointreau',
  'Galliano',
  'Chambord',
  'Pernod',
  'Ricard',
  'Jägermeister',
  'Jagermeister',
  'Malibu',
  'Midori',
  'Frangelico',
  'Angostura',
  "Peychaud's",
  'Tabasco',
  'Worcestershire',
  'Bacardi',
  'Smirnoff',
  'Absolut',
  'Tia Maria',
  'Southern Comfort',
  'Drambuie',
  'Benedictine',
  'Chartreuse',
  'Dubonnet',
  'Lillet',
  'Guinness',
  'Goldschlager',
  'Everclear',
  'Yukon Jack',
  'Rumple Minze',
  'Hpnotiq',
  'Godiva',
  'Hennessy',
  'Jack Daniels',
  'Jim Beam',
  'Captain Morgan',
  "Rose's",
  'Irish',
  'Scotch',
  'Jamaican',
  'Mexican',
  'Cuban',
  'Hawaiian',
  'Lemon-lime',
  'Collins',
];
const PROPER = PROPER_NAMES.map(
  name =>
    [
      new RegExp(
        `(^|[^\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}])`,
        'giu'
      ),
      name,
    ] as const
);

/** "Dark Rum" → "dark rum", "Highball Glass" → "highball glass", but "Coca-Cola" stays. */
function spoken(name: string): string {
  let text = name.trim().toLowerCase();
  for (const [pattern, proper] of PROPER)
    text = text.replace(pattern, (_, before: string) => before + proper);
  return text;
}

/** Coffee and tea drinks are named by what's hot in them. */
function hotDrinkNoun(names: string[]): string {
  if (names.some(n => /\bcoffee|espresso\b/i.test(n))) return 'coffee drink';
  if (names.some(n => /\btea\b/i.test(n))) return 'tea drink';
  return 'hot drink';
}

/** ["a", "b", "c"] → "a, b and c". */
function listOf(items: string[]): string {
  return items.length < 2
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

function traitsOf(names: string[]): string[] {
  const found = TRAITS.filter(([, pattern]) =>
    names.some(name => pattern.test(name))
  ).map(([trait]) => trait);
  // "sweet and sour" reads better as one idea.
  if (found.includes('sweet') && found.includes('sour'))
    return [
      'sweet-and-sour',
      ...found.filter(t => t !== 'sweet' && t !== 'sour'),
    ].slice(0, 2);
  return found.slice(0, 2);
}

/**
 * How a drink tastes, read from what goes in it (e.g. ["sweet-and-sour", "sparkling"]).
 * Empty when no ingredient clearly carries a taste.
 */
export function tastesOf(ingredients: { name: string }[]): string[] {
  return traitsOf(
    ingredients
      .map(i => i.name?.trim())
      .filter((name): name is string => !!name && !BASICS.test(name))
  );
}

/** A sentence for a TheCocktailDB drink with ingredient data; undefined without any. */
export function describeCatalogueDrink(
  recipe: Pick<Recipe, 'kind' | 'category' | 'glass' | 'ingredients'>
): string | undefined {
  const names = recipe.ingredients
    .map(i => i.name?.trim())
    .filter((name): name is string => !!name && !BASICS.test(name));
  if (!names.length) return undefined;

  const alcoholic = recipe.kind !== 'mocktail';
  const base = alcoholic ? names.find(isAlcoholic) : undefined;
  const noun =
    (recipe.category === 'Coffee / Tea' ? hotDrinkNoun(names) : undefined) ??
    CATEGORY_NOUNS[recipe.category ?? ''] ??
    (recipe.kind === 'mocktail'
      ? 'non-alcoholic drink'
      : recipe.kind === 'optional'
        ? 'drink (alcohol optional)'
        : 'cocktail');
  const traits = traitsOf(names);
  // "A coffee drink with coffee" says it twice.
  const named = noun.split(' ')[0];
  const others = names.filter(
    name => name !== base && name.toLowerCase() !== named
  );
  const shown = others.slice(0, base ? 3 : 4).map(spoken);

  const head = [traits.join(', '), base ? spoken(base) : '', noun]
    .filter(Boolean)
    .join(' ');
  const joiner = base ? 'with' : 'of';
  const glass = recipe.glass?.trim()
    ? `, served in ${article(recipe.glass.trim())} ${spoken(recipe.glass)}`
    : '';
  const body = shown.length ? ` ${joiner} ${listOf(shown)}` : '';
  return sentenceCase(`${article(head)} ${head}${body}${glass}.`);
}

/** A sentence for a venue-menu drink from the menu's flavour notes and ingredients. */
export function describeMenuDrink(drink: {
  kind: 'cocktail' | 'mocktail' | 'zero_proof';
  ingredients: string[];
  flavourNotes: string[];
}): string {
  const noun =
    drink.kind === 'zero_proof'
      ? 'zero-proof cocktail'
      : drink.kind === 'mocktail'
        ? 'mocktail'
        : 'cocktail';
  const flavours = drink.flavourNotes.map(f => f.trim()).filter(Boolean);
  const head = [flavours.join(', '), noun].filter(Boolean).join(' ');
  const body = drink.ingredients.length
    ? ` of ${listOf(drink.ingredients.map(i => i.trim()))}`
    : '';
  return sentenceCase(`${article(head)} ${head}${body}.`);
}
