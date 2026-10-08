import { InjectionToken } from '@angular/core';

import * as ProductListConfigData from '@app/branding/product-list';
import * as ProductDetailConfigData from '@app/branding/product-detail';
import {
  ProductDetailConfigModel,
  ProductListConfigModel,
} from '../models/product.model';

export const PRODUCT_LIST_CONFIG_DATA =
  new InjectionToken<ProductListConfigModel>('product-list.config');

export const PRODUCT_DETIAL_CONFIG_DATA =
  new InjectionToken<ProductDetailConfigModel>('product-detail.config');

export const API_URL = new InjectionToken<any>('api.config');

export const ProductListConfig: ProductListConfigModel = {
  ...ProductListConfigData,
};
export const ProductDetailConfig: ProductDetailConfigModel = {
  ...ProductDetailConfigData,
};
export const ApiURL: any = {
  apiUrl: 'https://www.thecocktaildb.com/api/json/v1/1/',
};
