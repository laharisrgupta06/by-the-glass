import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { toFailure } from 'src/app/core/ai/ai-failure';
import {
  BARTENDER_PATHS,
  BartenderAnswer,
  BartenderRequest,
  checkBartenderAnswer,
} from 'src/app/core/ai/ai-recipe';

/**
 * Asks our own server (never Gemini directly) for a new drink made from the person's
 * ingredients. Each answer is checked again here before it's shown.
 */
@Injectable({ providedIn: 'root' })
export class BartenderService {
  private http = inject(HttpClient);

  create(request: BartenderRequest): Observable<BartenderAnswer> {
    return this.http.post<unknown>(BARTENDER_PATHS.create, request).pipe(
      catchError(error => throwError(() => toFailure(error))),
      map(raw => {
        const recipe = checkBartenderAnswer(raw, request);
        // An answer that fails our checks is a failure, never shown as a recipe.
        if (!recipe) throw { code: 'failed' };
        return { recipe, basedOn: request.ingredients };
      })
    );
  }
}
