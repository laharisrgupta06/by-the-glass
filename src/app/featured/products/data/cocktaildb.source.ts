import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { ProductDetialsModel, ProductListModel } from '../models/product.model';
import {
  DrinkKind,
  Recipe,
  RecipeIngredient,
  RecipeTranslation,
} from '../models/recipe.model';
import { LETTER_PAGE_CAP, ProductService } from '../services/product.service';
import { describeCatalogueDrink, tastesOf } from '../utils/describe-drink';
import { iceFrom, servingFrom } from '../utils/recipe-details';
import { findGarnish } from '../utils/recipe-text';
import { Catalogue, preferDetailed } from './catalogue';
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

/** A field only when it has a value, so absent details stay absent. */
function optional<K extends string, V>(
  key: K,
  value: V | undefined
): Partial<Record<K, V>> {
  if (value === undefined || (Array.isArray(value) && !value.length)) return {};
  return { [key]: value } as Partial<Record<K, V>>;
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
  const kind = drink.strAlcoholic ? KINDS[drink.strAlcoholic] : undefined;
  const category = clean(drink.strCategory);
  const glass = clean(drink.strGlass);
  return {
    id: drink.idDrink,
    source: 'cocktaildb',
    credit: 'TheCocktailDB',
    name: drink.strDrink.trim(),
    image: thumb,
    // TheCocktailDB serves resized thumbnails; 350px is plenty for a card.
    thumbnail: thumb && `${thumb}/medium`,
    kind,
    category,
    glass,
    // TheCocktailDB has no description field: one sentence from its own data.
    description: describeCatalogueDrink({ kind, category, glass, ingredients }),
    // Read from its own ingredients and method; left out when they say nothing.
    ...optional('tastes', ingredients.length ? tastesOf(ingredients) : []),
    ...optional('ice', iceFrom(instructions, ingredients)),
    ...optional('serving', servingFrom(instructions)),
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
        this.browseList(filter, kind)
      )
    ).pipe(map(lists => lists.flat()));
  }

  /**
   * Every drink the free API lets us reach: the three browse lists plus every
   * first-letter page, one entry per drink (the detailed copy wins). Parts that fail
   * are reported rather than failing the whole catalogue.
   */
  catalogue(): Observable<Catalogue> {
    const lists$ = forkJoin(
      Object.entries(BROWSE_LISTS).map(([filter, kind]) =>
        this.browseList(filter, kind).pipe(
          map(recipes => ({ recipes, ok: true })),
          catchError(() => of({ recipes: [] as Recipe[], ok: false }))
        )
      )
    );
    return forkJoin([lists$, this.api.getCataloguePages()]).pipe(
      map(([lists, pages]) => ({
        recipes: preferDetailed([
          ...lists.flatMap(list => list.recipes),
          ...pages.flatMap(page => (page.drinks ?? []).map(fromCocktailDb)),
        ]),
        failedLetters: pages
          .filter(page => !page.drinks)
          .map(page => page.key.toUpperCase()),
        failedLists: lists.some(list => !list.ok),
        cappedLetters: pages
          .filter(page => (page.drinks?.length ?? 0) >= LETTER_PAGE_CAP)
          .map(page => page.key.toUpperCase()),
        missingDetails: 0,
      }))
    );
  }

  /**
   * The catalogue with every drink's ingredients, for ingredient matching (What Can I
   * Make?). Drinks only the browse lists name are looked up by id; a lookup that fails
   * leaves the bare entry and is counted, never guessed.
   */
  detailedCatalogue(): Observable<Catalogue> {
    return this.catalogue().pipe(
      switchMap(catalogue => {
        const bare = catalogue.recipes.filter(r => !r.hasDetails);
        return this.api.getDetailsByIds(bare.map(r => r.id)).pipe(
          map(found => {
            let missingDetails = 0;
            const recipes = catalogue.recipes.map(recipe => {
              if (recipe.hasDetails) return recipe;
              const drink = found.get(recipe.id);
              if (!drink) missingDetails++;
              return drink ? fromCocktailDb(drink) : recipe;
            });
            return { ...catalogue, recipes, missingDetails };
          })
        );
      })
    );
  }

  private browseList(filter: string, kind: DrinkKind): Observable<Recipe[]> {
    return this.api
      .getByFiltered(filter)
      .pipe(
        map(response =>
          toDrinks(response).map(drink => ({ ...fromCocktailDb(drink), kind }))
        )
      );
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
