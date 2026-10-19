import { InjectionToken } from '@angular/core';

/**
 * How ingredient names relate to each other when deciding what someone can make.
 * Kept deliberately small and explicit: every rule is one a bartender would agree
 * with, and nothing here is inferred. The curated dataset (or a future ingredient
 * service) can supply a richer set through INGREDIENT_RULES.
 */
export interface IngredientRules {
  /** Assumed to be on hand, so recipes never count them as missing. */
  basics: string[];
  /** Having the key ingredient also covers each listed one, e.g. a lime gives lime juice. */
  covers: Record<string, string[]>;
}

// Same spelling, different source conventions. Applied word by word.
const SPELLINGS: Record<string, string> = {
  whisky: 'whiskey',
  yogurt: 'yoghurt',
  sirup: 'syrup',
  // The venue menu writes both "passionfruit" and "passion fruit".
  passionfruit: 'passion fruit',
};

/**
 * The comparable form of an ingredient name: "Fresh Lime Juice", "lime juice" and
 * "Lime Juice" are one ingredient, as are "7-Up" and "7-up", or "Jägermeister" and
 * "Jagermeister".
 */
export function ingredientKey(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[-/]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => SPELLINGS[word] ?? word)
    .join(' ')
    .replace(/^fresh /, '');
}

/** Combines covers rules, so two rules for the same ingredient add up instead of replacing. */
function mergeCovers(
  ...parts: Record<string, string[]>[]
): Record<string, string[]> {
  const merged: Record<string, string[]> = {};
  for (const part of parts)
    for (const [have, needs] of Object.entries(part))
      merged[have] = [...new Set([...(merged[have] ?? []), ...needs])];
  return merged;
}

/** Each name covers all the others: they're the same thing under different labels. */
function sameThing(...names: string[]): Record<string, string[]> {
  return Object.fromEntries(
    names.map(name => [name, names.filter(other => other !== name)])
  );
}

/**
 * Tuned to TheCocktailDB ingredient names. Directional on purpose: Cointreau is a
 * triple sec, but a recipe that asks for Cointreau by name isn't covered by any triple sec.
 */
export const DEFAULT_INGREDIENT_RULES: IngredientRules = {
  basics: ['Ice', 'Ice cubes', 'Crushed ice', 'Cracked ice', 'Water'],
  covers: mergeCovers(
    {
      // Whole citrus can be juiced or peeled.
      Lime: ['Lime juice', 'Lime peel'],
      Lemon: ['Lemon juice', 'Lemon peel'],
      Orange: ['Orange juice', 'Orange peel', 'Orange spiral'],
      // A named style or brand covers the generic call, not the other way round.
      Bourbon: ['Whiskey'],
      Scotch: ['Whiskey'],
      'Blended Scotch': ['Whiskey', 'Scotch'],
      'Irish whiskey': ['Whiskey'],
      'Rye whiskey': ['Whiskey'],
      'Blended whiskey': ['Whiskey'],
      'Tennessee whiskey': ['Whiskey'],
      'Light rum': ['Rum', 'White rum'],
      'White rum': ['Rum', 'Light rum'],
      'Dark rum': ['Rum'],
      'Gold rum': ['Rum'],
      'Añejo rum': ['Rum'],
      'Absolut Vodka': ['Vodka'],
      Cognac: ['Brandy'],
      Cointreau: ['Triple sec'],
      'Baileys irish cream': ['Irish cream'],
      Kahlua: ['Coffee liqueur'],
      'Tia maria': ['Coffee liqueur'],
      Lager: ['Beer'],
      Corona: ['Beer', 'Lager'],
    },
    sameThing('Soda water', 'Club soda', 'Carbonated water'),
    sameThing('Sour mix', 'Sweet and sour'),
    sameThing('7-Up', 'Sprite', 'Lemon-lime soda'),
    // Names the venue menu shortens.
    sameThing('Tonic water', 'Tonic'),
    sameThing('Tabasco sauce', 'Tabasco'),
    sameThing('Mint', 'Mint leaves'),
    {
      // The menu's generic "soda" is soda water (Indian bar usage). One way: a recipe
      // that asks for soda water specifically isn't covered by "soda".
      'Soda water': ['Soda'],
      'Club soda': ['Soda'],
      'Carbonated water': ['Soda'],
      // A brand covers the generic call, never the reverse.
      'Coca-Cola': ['Cola'],
      'Pepsi Cola': ['Cola'],
      // Pink guava juice is a guava juice; plain guava juice isn't pink guava juice.
      'Pink guava juice': ['Guava juice'],
      // Branded spirits on the venue menu, by the section the menu lists them under.
      'Camino Blanco': ['Tequila'],
      'Camino Gold': ['Tequila'],
      "Dewar's White Label": ['Whiskey', 'Blended whiskey'],
      'Bacardi Carta Blanca': ['Rum', 'White rum', 'Light rum'],
      'Bacardi Black': ['Rum', 'Dark rum'],
    }
    // Deliberately absent: the menu lexicon's "lime = lime juice" (a lime covers lime
    // juice, above, but juice can't stand in for a wedge or peel), and anything
    // equating alcohol-free spirits such as "Sober gin" with gin or rum.
  ),
};

export const INGREDIENT_RULES = new InjectionToken<IngredientRules>(
  'ingredient-rules',
  { providedIn: 'root', factory: () => DEFAULT_INGREDIENT_RULES }
);
