import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';

import {
  INTERPRET_PATHS,
  IngredientInterpretation,
  InterpretRequest,
  sanitizeInterpretation,
} from 'src/app/core/ai/ingredient-interpretation';
import { toFailure } from 'src/app/core/ai/ai-failure';

// Moved to core so every AI feature reads failures the same way.
export { toFailure } from 'src/app/core/ai/ai-failure';
export type {
  InterpretFailure,
  InterpretFailureCode,
} from 'src/app/core/ai/ai-failure';

/**
 * Asks our own server (never Gemini directly) what an unmatched ingredient is.
 * The server holds the API key; without one, this reports itself unavailable and
 * the page simply doesn't offer to ask.
 */
@Injectable({ providedIn: 'root' })
export class IngredientInterpreterService {
  private http = inject(HttpClient);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private checked = false;
  private answers = new Map<string, IngredientInterpretation>();

  readonly available = signal(false);

  /** Asks the server once per session whether interpretation is switched on. */
  checkAvailability(): void {
    if (!this.isBrowser || this.checked) return;
    this.checked = true;
    this.http.get<{ available?: unknown }>(INTERPRET_PATHS.status).subscribe({
      next: status => this.available.set(status?.available === true),
      // No server (static hosting, plain ng serve without the API): stay off.
      error: () => this.available.set(false),
    });
  }

  interpret(
    term: string,
    vocabulary: string[]
  ): Observable<IngredientInterpretation> {
    const key = term.trim().toLowerCase();
    const known = this.answers.get(key);
    if (known) return of(known);
    const body: InterpretRequest = { term, vocabulary };
    return this.http.post<unknown>(INTERPRET_PATHS.interpret, body).pipe(
      // Checked again here: only ingredients we sent can come back.
      map(raw => sanitizeInterpretation(raw, term, vocabulary)),
      tap(answer => this.answers.set(key, answer)),
      catchError((error: unknown) => {
        const failure = toFailure(error);
        // Only "no key configured" switches the feature off; everything else can be retried.
        if (failure.code === 'unavailable') this.available.set(false);
        return throwError(() => failure);
      })
    );
  }
}
