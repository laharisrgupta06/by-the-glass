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
      ProductsStore,
      ProductService,
      {
        provide: PRODUCT_LIST_CONFIG_DATA,
        useValue: ProductListConfig,
      },
      {
        provide: API_URL,
        useValue: ApiURL,
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
      ProductsStore,
      ProductService,
      {
        provide: PRODUCT_DETIAL_CONFIG_DATA,
        useValue: ProductDetailConfig,
      },
      {
        provide: API_URL,
        useValue: ApiURL,
      },
    ],
    loadComponent: () =>
      import(
        './featured/products/pages/product-details/product-details.component'
      ).then(m => m.ProductDetailsComponent),
  },
  {
    path: 'what-can-i-make',
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
  {
    path: '**',
    redirectTo: '',
    //,component: PageNotFoundComponent,
    pathMatch: 'full',
  },
];
