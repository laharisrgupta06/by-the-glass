import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import {
  Observable,
  catchError,
  from,
  map,
  mergeMap,
  of,
  retry,
  shareReplay,
  tap,
  throwError,
  timer,
  toArray,
} from 'rxjs';
import { BaseService } from 'src/app/core/services/base.service';
import { API_URL } from '../config/product.config';
import { ProductDetialsModel, ProductListModel } from '../models/product.model';
import { isRequestTimeout } from './cocktaildb-timeout.interceptor';

// TheCocktailDB answers "no results" with null or a string instead of an empty array.
const toDrinks = (response: ProductListModel) =>
  Array.isArray(response?.drinks) ? response.drinks : [];

const CATALOGUE_KEYS = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
const CATALOGUE_CONCURRENCY = 3;

/** On the free key, a first-letter search stops at this many drinks. */
export const LETTER_PAGE_CAP = 25;

/**
 * TheCocktailDB rate-limits bursts (HTTP 429, which browsers see as a network error
 * because the response has no CORS headers). A failed request is tried again after this
 * pause, and once more after twice as long; a timed-out one isn't, since it already waited.
 */
export const LETTER_RETRY_MS = 2_000;

/** One first-letter search: its drinks, or null when that request failed. */
export interface CataloguePage {
  key: string;
  drinks: ProductDetialsModel[] | null;
}

// Module-level so the catalogue survives route changes (the service is route-provided).
let pages$: Observable<CataloguePage[]> | null = null;
// Full details by id (lookup.php) for drinks only the browse lists name. Same reason.
const lookups = new Map<string, Observable<ProductDetialsModel | null>>();

/** Forgets the loaded catalogue, so the next request fetches it again. For tests. */
export function clearCatalogueCache(): void {
  pages$ = null;
  lookups.clear();
}

/** Retries after a failure that isn't a timeout: LETTER_RETRY_MS, then twice that. */
export const LETTER_RETRIES = 2;
function retryOnce<T>() {
  return retry<T>({
    count: LETTER_RETRIES,
    delay: (error, attempt) =>
      isRequestTimeout(error)
        ? throwError(() => error)
        : timer(LETTER_RETRY_MS * attempt),
  });
}

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
   * Every first-letter search, one page per letter or digit, with full ingredient data.
   * A failed letter comes back as a page without drinks instead of failing the rest.
   * Fetched once per session, a few requests at a time; kept only when every page
   * loaded, so a retry fetches again.
   */
  getCataloguePages(): Observable<CataloguePage[]> {
    if (!pages$) {
      const request$: Observable<CataloguePage[]> = from(CATALOGUE_KEYS).pipe(
        mergeMap(
          key =>
            this.searchByFirstLetter(key).pipe(
              retryOnce(),
              map(response => ({ key, drinks: toDrinks(response) })),
              catchError(() => of({ key, drinks: null }))
            ),
          CATALOGUE_CONCURRENCY
        ),
        toArray(),
        map(pages =>
          pages.sort(
            (a, b) =>
              CATALOGUE_KEYS.indexOf(a.key) - CATALOGUE_KEYS.indexOf(b.key)
          )
        ),
        tap(pages => {
          if (pages.some(page => !page.drinks) && pages$ === request$)
            pages$ = null;
        }),
        shareReplay(1)
      );
      pages$ = request$;
    }
    return pages$;
  }

  /**
   * Full details for drinks the browse lists name but no first-letter page includes
   * (the letter pages stop at 25). A few at a time, each retried as above; a lookup
   * that still fails comes back as null and is asked again next time.
   */
  getDetailsByIds(
    ids: string[]
  ): Observable<Map<string, ProductDetialsModel | null>> {
    if (!ids.length) return of(new Map());
    return from(ids).pipe(
      mergeMap(
        id => this.lookup(id).pipe(map(drink => [id, drink] as const)),
        CATALOGUE_CONCURRENCY
      ),
      toArray(),
      map(entries => new Map(entries))
    );
  }

  private lookup(id: string): Observable<ProductDetialsModel | null> {
    let drink$ = lookups.get(id);
    if (!drink$) {
      drink$ = this.getDeatilsByID(id).pipe(
        retryOnce(),
        map(response => toDrinks(response)[0] ?? null),
        catchError(() => {
          lookups.delete(id);
          return of(null);
        }),
        shareReplay(1)
      );
      lookups.set(id, drink$);
    }
    return drink$;
  }

  /**
   * Every drink the API returns by first letter, with full ingredient data.
   * The free API key limits filter.php?i= to a single result, so ingredient
   * search scans this instead. All or nothing: fails if any letter failed.
   */
  getCatalogue(): Observable<ProductDetialsModel[]> {
    return this.getCataloguePages().pipe(
      map(pages => {
        if (pages.some(page => !page.drinks))
          throw new Error('Part of the drinks catalogue failed to load.');
        return pages.flatMap(page => page.drinks ?? []);
      })
    );
  }
}
