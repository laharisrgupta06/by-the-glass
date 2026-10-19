import { tick } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

/**
 * Fake TheCocktailDB answers for specs that load the drinks catalogue.
 * Only imported by specs.
 */

export const PHOTO = 'https://www.thecocktaildb.com/images/media/drink/x.jpg';

/** A drink as the first-letter search returns it: with ingredients and method. */
export const detailed = (
  id: string,
  name: string,
  alcoholic = 'Alcoholic'
) => ({
  idDrink: id,
  strDrink: name,
  strDrinkThumb: PHOTO,
  strAlcoholic: alcoholic,
  strInstructions: 'Shake with ice and strain into a chilled glass.',
  strIngredient1: 'Gin',
  strMeasure1: '2 oz',
  strIngredient2: 'Lime juice',
  strMeasure2: '1 oz',
  strIngredient3: 'Sugar syrup',
  strMeasure3: '1/2 oz',
});

/** A drink as the browse lists return it: name and photo only. */
export const listed = (id: string, name: string) => ({
  idDrink: id,
  strDrink: name,
  strDrinkThumb: PHOTO,
});

export type Drink = ReturnType<typeof detailed> | ReturnType<typeof listed>;

/** Answers the three browse lists; a missing entry answers with a server error. */
export function answerLists(
  http: HttpTestingController,
  lists: Record<string, Drink[] | 'fail'>
) {
  for (const req of http.match(r => r.url.endsWith('filter.php'))) {
    const answer = lists[req.request.params.get('a')!] ?? [];
    if (answer === 'fail')
      req.flush('down', { status: 500, statusText: 'Server Error' });
    else req.flush({ drinks: answer.length ? answer : null });
  }
}

type PageAnswer = Drink[] | 'fail';

/**
 * Answers every first-letter search as it is made (three at a time). A function
 * answers by attempt (1, then 2 for the retry). Failed letters are retried after a
 * pause, so specs with failures run in fakeAsync and pass that pause as retryDelay.
 */
export function answerLetters(
  http: HttpTestingController,
  pages: Record<string, PageAnswer | ((attempt: number) => PageAnswer)> = {},
  retryDelay = 0
): string[] {
  const asked: string[] = [];
  let waited = 0;
  for (let round = 0; round < 200; round++) {
    const requests = http.match(
      r => r.url.endsWith('search.php') && r.params.has('f')
    );
    if (!requests.length) {
      // Retries wait retryDelay, then twice that: allow a few quiet pauses.
      if (!retryDelay || waited >= 3) break;
      tick(retryDelay);
      waited++;
      continue;
    }
    waited = 0;
    for (const req of requests) {
      const key = req.request.params.get('f')!;
      asked.push(key);
      const page = pages[key] ?? [];
      const answer =
        typeof page === 'function'
          ? page(asked.filter(k => k === key).length)
          : page;
      if (answer === 'fail')
        req.flush('down', { status: 500, statusText: 'Server Error' });
      else req.flush({ drinks: answer.length ? answer : null });
    }
  }
  return asked;
}

export const fillers = (letter: string, n: number) =>
  Array.from({ length: n }, (_, i) =>
    detailed(`${letter}${i}`, `${letter.toUpperCase()} Filler ${i}`)
  );
