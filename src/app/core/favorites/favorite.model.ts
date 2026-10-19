/** What's needed to save a drink. Recipe satisfies this shape. */
export interface FavoriteDrink {
  source: 'cocktaildb' | 'curated' | 'venue-menu';
  id: string;
  name: string;
  thumbnail?: string;
  kind?: 'cocktail' | 'mocktail' | 'optional';
}

/**
 * A saved drink as stored: users/{userId}/favorites/{source}_{drinkId}.
 * Name, thumbnail and kind are a snapshot so Personal can list favorites
 * without re-fetching every drink.
 */
export interface FavoriteRecord {
  userId: string;
  source: FavoriteDrink['source'];
  drinkId: string;
  name: string;
  thumbnail?: string;
  kind?: FavoriteDrink['kind'];
  createdAt: Date | null;
}

export function favoriteKey(source: string, drinkId: string): string {
  return `${source}_${drinkId}`;
}
