import { InjectionToken } from '@angular/core';

export interface SpiritDefinition {
  /** Stable id used in the URL, e.g. ?spirit=whiskey */
  id: string;
  label: string;
  /** Whole words/phrases matched against ingredient names, case-insensitive. */
  terms: string[];
  /** Ingredients that contain a term but aren't the spirit, e.g. cherry brandy is a liqueur. */
  exclude?: string[];
}

/**
 * Starting taxonomy, tuned to TheCocktailDB ingredient names. The curated dataset
 * can provide a larger list (sub-styles, regional spirits) through SPIRIT_TAXONOMY.
 */
export const DEFAULT_SPIRITS: SpiritDefinition[] = [
  { id: 'gin', label: 'Gin', terms: ['gin'] },
  { id: 'vodka', label: 'Vodka', terms: ['vodka'] },
  { id: 'rum', label: 'Rum', terms: ['rum', 'bacardi'] },
  {
    id: 'tequila',
    label: 'Tequila',
    // Brands from the venue menu, listed there under "Tequila".
    terms: ['tequila', 'camino blanco', 'camino gold'],
  },
  { id: 'mezcal', label: 'Mezcal', terms: ['mezcal'] },
  {
    id: 'whiskey',
    label: 'Whiskey',
    // Dewar's is listed under "Blended Whiskey" on the venue menu.
    terms: [
      'whiskey',
      'whisky',
      'bourbon',
      'scotch',
      'jack daniels',
      "dewar's",
    ],
  },
  {
    id: 'brandy',
    label: 'Brandy & cognac',
    terms: ['brandy', 'cognac', 'applejack'],
    exclude: [
      'apricot brandy',
      'blackberry brandy',
      'cherry brandy',
      'coffee brandy',
      'peach brandy',
    ],
  },
  { id: 'cachaca', label: 'Cachaça', terms: ['cachaca', 'cachaça'] },
  { id: 'pisco', label: 'Pisco', terms: ['pisco'] },
  { id: 'absinthe', label: 'Absinthe', terms: ['absinthe'] },
];

export const SPIRIT_TAXONOMY = new InjectionToken<SpiritDefinition[]>(
  'spirit-taxonomy',
  { providedIn: 'root', factory: () => DEFAULT_SPIRITS }
);
