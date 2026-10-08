import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';

import { ProductDetialsModel, ProductListModel } from '../models/product.model';
import {
  DrinkKind,
  Recipe,
  RecipeIngredient,
  RecipeTranslation,
} from '../models/recipe.model';
import { ProductService } from '../services/product.service';
import { findGarnish } from '../utils/recipe-text';
import { DrinkSource } from './drink-source';

const KINDS: Record<string, DrinkKind> = {
  Alcoholic: 'cocktail',
  'Non alcoholic': 'mocktail',
  'Optional alcohol': 'optional',
};

// The browse lists don't say whether a drink is alcoholic, so it's tagged by list.
const BROWSE_LISTS: Record<string, DrinkKind> = {
  Alcoholic: 'cocktail',
  Non_Alcoholic: 'mocktail',
  Optional_alcohol: 'optional',
};

const TRANSLATIONS: [keyof ProductDetialsModel, string, string][] = [
  ['strInstructionsES', 'es', 'Español'],
  ['strInstructionsDE', 'de', 'Deutsch'],
  ['strInstructionsFR', 'fr', 'Français'],
  ['strInstructionsIT', 'it', 'Italiano'],
  ['strInstructionsZH-HANS', 'zh-Hans', '简体中文'],
  ['strInstructionsZH-HANT', 'zh-Hant', '繁體中文'],
];

// TheCocktailDB answers "no results" with null or a string instead of an empty array.
function toDrinks(response: ProductListModel | null | undefined) {
  return Array.isArray(response?.drinks) ? response.drinks : [];
}

// The API uses null for missing fields and pads values with whitespace.
function clean(value: string | null | undefined): string | undefined {
  return value?.trim() || undefined;
}

export function fromCocktailDb(drink: ProductDetialsModel): Recipe {
  const ingredients: RecipeIngredient[] = [];
  for (let i = 1; i <= 15; i++) {
    const name = clean(drink[`strIngredient${i}` as keyof ProductDetialsModel]);
    const measure = clean(drink[`strMeasure${i}` as keyof ProductDetialsModel]);
    if (name) ingredients.push(measure ? { name, measure } : { name });
  }

  const translations: RecipeTranslation[] = [];
  for (const [key, lang, label] of TRANSLATIONS) {
    const text = clean(drink[key]);
    if (text) translations.push({ lang, label, text });
  }

  const instructions = clean(drink.strInstructions);
  const thumb = clean(drink.strDrinkThumb);
  return {
    id: drink.idDrink,
    source: 'cocktaildb',
    credit: 'TheCocktailDB',
    name: drink.strDrink.trim(),
    image: thumb,
    // TheCocktailDB serves resized thumbnails; 350px is plenty for a card.
    thumbnail: thumb && `${thumb}/medium`,
    kind: drink.strAlcoholic ? KINDS[drink.strAlcoholic] : undefined,
    category: clean(drink.strCategory),
    glass: clean(drink.strGlass),
    garnish: findGarnish(instructions, ingredients),
    iba: clean(drink.strIBA),
    ingredients,
    instructions,
    translations,
    hasDetails: drink.strInstructions !== undefined,
  };
}

@Injectable()
export class CocktailDbSource implements DrinkSource {
  private api = inject(ProductService);

  browse(): Observable<Recipe[]> {
    return forkJoin(
      Object.entries(BROWSE_LISTS).map(([filter, kind]) =>
        this.api.getByFiltered(filter).pipe(
          map(response =>
            toDrinks(response).map(drink => ({
              ...fromCocktailDb(drink),
              kind,
            }))
          )
        )
      )
    ).pipe(map(lists => lists.flat()));
  }

  byLetter(letter: string): Observable<Recipe[]> {
    return this.api
      .searchByFirstLetter(letter)
      .pipe(map(response => toDrinks(response).map(fromCocktailDb)));
  }

  searchByName(query: string): Observable<Recipe[]> {
    return this.api
      .searchByName(query)
      .pipe(map(response => toDrinks(response).map(fromCocktailDb)));
  }

  detailed(): Observable<Recipe[]> {
    return this.api
      .getCatalogue()
      .pipe(map(drinks => drinks.map(fromCocktailDb)));
  }

  byId(id: string): Observable<Recipe | undefined> {
    return this.api.getDeatilsByID(id).pipe(
      map(response => {
        const drink = toDrinks(response)[0];
        return drink && fromCocktailDb(drink);
      })
    );
  }
}
