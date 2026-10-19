import { InjectionToken } from '@angular/core';

export type Taste = 'sweet' | 'sour' | 'bitter' | 'spicy';

/**
 * Our drinks source has no tasting notes, so a taste is read from ingredients that
 * clearly carry it, and the page says so. When the curated dataset brings real
 * flavour profiles, provide a classifier through TASTE_SIGNALS instead.
 */
export interface TasteDefinition {
  id: Taste;
  label: string;
  /** Shown when the taste is picked, so it's clear how it was decided. */
  basis: string;
  /** Exact ingredients that carry the taste. */
  ingredients: string[];
  /** Words that carry it wherever they appear, e.g. any "… syrup". */
  words?: string[];
}

export const DEFAULT_TASTES: TasteDefinition[] = [
  {
    id: 'sweet',
    label: 'Sweet',
    basis: 'a sugar, syrup, honey or liqueur',
    ingredients: ['Grenadine', 'Condensed milk', 'Cream of coconut'],
    words: ['sugar', 'syrup', 'honey', 'liqueur', 'schnapps', 'cordial'],
  },
  {
    id: 'sour',
    label: 'Sour',
    basis: 'lemon, lime or sour mix',
    ingredients: [
      'Lemon',
      'Lime',
      'Lemon juice',
      'Lime juice',
      'Sour mix',
      'Sweet and sour',
    ],
  },
  {
    id: 'bitter',
    label: 'Bitter',
    basis: 'a bitter aperitivo, amaro or tonic',
    ingredients: ['Campari', 'Aperol', 'Tonic water', 'Bitter lemon'],
    words: ['amaro'],
  },
  {
    id: 'spicy',
    label: 'Spicy',
    basis: 'ginger, chilli, pepper or hot sauce',
    ingredients: [
      'Ginger',
      'Ginger beer',
      'Ginger syrup',
      'Tabasco sauce',
      'Hot sauce',
      'Cayenne pepper',
      'Black pepper',
      'Pepper',
      'Red chili flakes',
      'Absolut Peppar',
    ],
  },
];

export const TASTE_SIGNALS = new InjectionToken<TasteDefinition[]>(
  'taste-signals',
  { providedIn: 'root', factory: () => DEFAULT_TASTES }
);
