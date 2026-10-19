import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import { Recipe } from '../models/recipe.model';
import { refineNameMatches, startsWithLetter } from '../utils/drink-filters';
import { CURATED_RECIPES } from './curated-recipes';
import { DrinkSource } from './drink-source';

@Injectable()
export class CuratedSource implements DrinkSource {
  private recipes = CURATED_RECIPES;

  browse(): Observable<Recipe[]> {
    return of(this.recipes);
  }

  byLetter(letter: string): Observable<Recipe[]> {
    return of(this.recipes.filter(recipe => startsWithLetter(recipe, letter)));
  }

  searchByName(query: string): Observable<Recipe[]> {
    return of(refineNameMatches(this.recipes, query));
  }

  detailed(): Observable<Recipe[]> {
    return of(this.recipes.filter(recipe => recipe.hasDetails));
  }

  byId(id: string): Observable<Recipe | undefined> {
    return of(this.recipes.find(recipe => recipe.id === id));
  }
}
