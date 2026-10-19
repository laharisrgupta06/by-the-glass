import { Routes } from '@angular/router';
import {
  API_URL,
  ApiURL,
  PRODUCT_DETIAL_CONFIG_DATA,
  PRODUCT_LIST_CONFIG_DATA,
  ProductDetailConfig,
  ProductListConfig,
} from './featured/products/config/product.config';
import { ProductsStore } from './featured/products/store/product.store';
import { ProductService } from './featured/products/services/product.service';
import { DrinkRepository } from './featured/products/data/drink.repository';
import { CocktailDbSource } from './featured/products/data/cocktaildb.source';
import { CuratedSource } from './featured/products/data/curated.source';
import { CabinetStore } from './featured/what-can-i-make/store/cabinet.store';

// Each drinks route gets its own store; the data layer underneath is the same.
const DRINK_DATA_PROVIDERS = [
  ProductsStore,
  ProductService,
  DrinkRepository,
  CocktailDbSource,
  CuratedSource,
  { provide: API_URL, useValue: ApiURL },
];

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./featured/home/pages/home/home.component').then(
        m => m.HomeComponent
      ),
  },
  {
    path: 'drinks',
    providers: [
      ...DRINK_DATA_PROVIDERS,
      {
        provide: PRODUCT_LIST_CONFIG_DATA,
        useValue: ProductListConfig,
      },
    ],
    loadComponent: () =>
      import(
        './featured/products/pages/product-list/product-list.component'
      ).then(m => m.ProductListComponent),
  },
  {
    path: 'product-details/:id',
    providers: [
      ...DRINK_DATA_PROVIDERS,
      {
        provide: PRODUCT_DETIAL_CONFIG_DATA,
        useValue: ProductDetailConfig,
      },
    ],
    loadComponent: () =>
      import(
        './featured/products/pages/product-details/product-details.component'
      ).then(m => m.ProductDetailsComponent),
  },
  {
    path: 'what-can-i-make',
    providers: [...DRINK_DATA_PROVIDERS, CabinetStore],
    loadComponent: () =>
      import(
        './featured/what-can-i-make/pages/what-can-i-make/what-can-i-make.component'
      ).then(m => m.WhatCanIMakeComponent),
  },
  {
    path: 'personal',
    loadComponent: () =>
      import('./featured/personal/pages/personal/personal.component').then(
        m => m.PersonalComponent
      ),
  },
  // My recipes: written by the person, private to them.
  {
    path: 'personal/recipes/new',
    loadComponent: () =>
      import(
        './featured/personal/pages/recipe-editor/recipe-editor.component'
      ).then(m => m.RecipeEditorComponent),
  },
  {
    path: 'personal/recipes/:id/edit',
    loadComponent: () =>
      import(
        './featured/personal/pages/recipe-editor/recipe-editor.component'
      ).then(m => m.RecipeEditorComponent),
  },
  {
    path: 'personal/recipes/:id',
    loadComponent: () =>
      import('./featured/personal/pages/my-recipe/my-recipe.component').then(
        m => m.MyRecipeComponent
      ),
  },
  {
    path: 'personal/saved-recipes/:id',
    loadComponent: () =>
      import(
        './featured/personal/pages/saved-recipe/saved-recipe.component'
      ).then(m => m.SavedRecipeComponent),
  },
  {
    path: '**',
    redirectTo: '',
    //,component: PageNotFoundComponent,
    pathMatch: 'full',
  },
];
