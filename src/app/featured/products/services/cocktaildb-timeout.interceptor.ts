import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { TimeoutError, catchError, throwError, timeout } from 'rxjs';

const COCKTAILDB_HOST = 'www.thecocktaildb.com';

/**
 * How long to wait for TheCocktailDB. Server rendering waits for every request before
 * it sends the page, so it gives up sooner and leaves the rest to the browser.
 */
export const COCKTAILDB_TIMEOUT_MS = { server: 5_000, browser: 15_000 };

export function isCocktailDbRequest(url: string): boolean {
  try {
    return new URL(url).host === COCKTAILDB_HOST;
  } catch {
    // Relative URLs, such as our own /api routes, are never TheCocktailDB.
    return false;
  }
}

/** True for a request this interceptor gave up on. */
export function isRequestTimeout(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse && error.error instanceof TimeoutError
  );
}

/**
 * Stops a slow TheCocktailDB request from hanging a page. Only TheCocktailDB: our /api
 * routes have their own server-side limits, and Firebase doesn't use HttpClient.
 * A timeout arrives as an ordinary HttpErrorResponse, so existing error handling applies.
 */
export const cocktailDbTimeoutInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isCocktailDbRequest(req.url)) return next(req);
  const limit = isPlatformServer(inject(PLATFORM_ID))
    ? COCKTAILDB_TIMEOUT_MS.server
    : COCKTAILDB_TIMEOUT_MS.browser;
  return next(req).pipe(
    // "each": HttpClient emits a Sent event straight away, then the response.
    timeout({ each: limit }),
    catchError((error: unknown) =>
      throwError(() =>
        error instanceof TimeoutError
          ? new HttpErrorResponse({
              error,
              status: 0,
              statusText: 'Timed out',
              url: req.urlWithParams,
            })
          : error
      )
    )
  );
};
