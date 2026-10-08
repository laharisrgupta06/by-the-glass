import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import {
  Observable,
  catchError,
  from,
  mergeMap,
  reduce,
  shareReplay,
  throwError,
} from 'rxjs';
import { BaseService } from 'src/app/core/services/base.service';
import { API_URL } from '../config/product.config';
import { ProductDetialsModel, ProductListModel } from '../models/product.model';

// TheCocktailDB answers "no results" with null or a string instead of an empty array.
const toDrinks = (response: ProductListModel) =>
  Array.isArray(response?.drinks) ? response.drinks : [];

const CATALOGUE_KEYS = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
const CATALOGUE_CONCURRENCY = 3;

// Module-level so the catalogue survives route changes (the service is route-provided).
let catalogue$: Observable<ProductDetialsModel[]> | null = null;

@Injectable()
export class ProductService extends BaseService<ProductListModel> {
  constructor(
    httpClient: HttpClient,
    @Inject(API_URL) private api_url: any
  ) {
    super(httpClient, api_url.apiUrl);
  }

  getByFiltered(query: string): Observable<ProductListModel> {
    this.path = `filter.php`;
    const params = new HttpParams({
      fromObject: {
        a: query,
      },
    });
    return this.get(params);
  }

  getDeatilsByID(id: string): Observable<ProductListModel> {
    this.path = `lookup.php`;
    const params = new HttpParams({
      fromObject: {
        i: id,
      },
    });
    return this.get(params);
  }

  searchByName(name: string): Observable<ProductListModel> {
    this.path = `search.php`;
    return this.get(new HttpParams({ fromObject: { s: name } }));
  }

  searchByFirstLetter(letter: string): Observable<ProductListModel> {
    this.path = `search.php`;
    return this.get(new HttpParams({ fromObject: { f: letter } }));
  }

  /**
   * Every drink the API returns by first letter, with full ingredient data.
   * The free API key limits filter.php?i= to a single result, so ingredient
   * search scans this instead. Fetched once per session, a few requests at a time.
   */
  getCatalogue(): Observable<ProductDetialsModel[]> {
    if (!catalogue$) {
      catalogue$ = from(CATALOGUE_KEYS).pipe(
        mergeMap(key => this.searchByFirstLetter(key), CATALOGUE_CONCURRENCY),
        reduce<ProductListModel, ProductDetialsModel[]>(
          (all, response) => all.concat(toDrinks(response)),
          []
        ),
        catchError(error => {
          catalogue$ = null;
          return throwError(() => error);
        }),
        shareReplay(1)
      );
    }
    return catalogue$;
  }
}
