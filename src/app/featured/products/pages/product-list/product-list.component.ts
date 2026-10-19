import { Component, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';

import { DrinkFiltersComponent } from '../../components/drink-filters/drink-filters.component';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { PRODUCT_LIST_CONFIG_DATA } from '../../config/product.config';
import { curate } from '../../data/recipe-quality';
import { SPIRIT_TAXONOMY } from '../../data/spirit-taxonomy';
import { Recipe, RecipeSource } from '../../models/recipe.model';
import { LETTER_PAGE_CAP } from '../../services/product.service';
import { ProductsStore } from '../../store/product.store';
import {
  DrinkQuery,
  DrinkType,
  byName,
  drinkLabel,
  matchedIngredient,
  matchesType,
  parseFilters,
  spiritIngredient,
  startsWithLetter,
  toQuery,
} from '../../utils/drink-filters';

// Where the browsable drinks come from, in the words the page uses.
const SOURCE_NAMES: Record<RecipeSource, string> = {
  curated: 'our own collection',
  cocktaildb: 'TheCocktailDB’s free API',
  'venue-menu': 'the venue menu',
  // Never in the Drinks list; here so every source has a name.
  own: 'your own recipes',
};

// The catalogue has one first-letter page per letter and digit.
const CATALOGUE_PAGES = 36;
const MAX_LISTED_LETTERS = 5;

/** ["A", "B", "C"] → "A, B and C". */
function listOf(items: string[]): string {
  return items.length < 2
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const NOUNS: Record<DrinkType, [string, string]> = {
  both: ['drink', 'drinks'],
  cocktail: ['cocktail', 'cocktails'],
  mocktail: ['mocktail', 'mocktails'],
};

const sameQuery = (a: DrinkQuery, b: DrinkQuery) =>
  a.q === b.q && a.letter === b.letter && a.spirit === b.spirit;

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [ProductCardComponent, DrinkFiltersComponent],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss',
})
export class ProductListComponent implements OnInit {
  productListConfig = inject(PRODUCT_LIST_CONFIG_DATA);
  readonly productsStore = inject(ProductsStore);
  readonly spirits = inject(SPIRIT_TAXONOMY);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  /** Filters live in the URL so results survive a trip to a drink's details and back. */
  readonly filters = toSignal(
    this.route.queryParamMap.pipe(
      map(params => parseFilters(params, this.spirits))
    ),
    { requireSync: true }
  );

  readonly spirit = computed(() =>
    this.spirits.find(s => s.id === this.filters().spirit)
  );

  readonly skeletons = Array.from({ length: 12 }, (_, i) => i);

  /**
   * Loaded recipes minus incomplete, trivial and duplicate ones. With a letter chosen,
   * only that letter counts, so the "left off" note is about what's on screen.
   */
  private readonly curated = computed(() => {
    const { letter } = this.filters();
    const recipes = this.productsStore.recipes();
    return curate(
      letter ? recipes.filter(r => startsWithLetter(r, letter)) : recipes
    );
  });

  readonly drinks = computed(() => {
    const { letter, type } = this.filters();
    const spirit = this.spirit();
    const drinks = this.curated().recipes.filter(
      recipe =>
        matchesType(recipe, type) &&
        (!letter || startsWithLetter(recipe, letter)) &&
        (!spirit || spiritIngredient(recipe, spirit))
    );
    // Search results keep their order (name matches first); everything else reads A–Z.
    return toQuery(this.filters()).q ? drinks : [...drinks].sort(byName);
  });

  readonly cards = computed(() => {
    const q = toQuery(this.filters()).q;
    return this.drinks().map(recipe => ({
      recipe,
      detail: this.describe(recipe, q),
    }));
  });

  readonly hasFilters = computed(() => {
    const { q, letter, type, spirit } = this.filters();
    return !!(q || letter || spirit || type !== 'both');
  });

  readonly summary = computed(() => {
    const status = this.productsStore.status();
    if (status === 'loading' || status === 'idle') return 'Pouring…';
    if (status === 'error') return '';
    const { letter, type } = this.filters();
    const { q } = toQuery(this.filters());
    const count = this.drinks().length;
    let text = `${count} ${NOUNS[type][count === 1 ? 0 : 1]}`;
    if (this.spirit()) text += ` with ${this.spirit()!.label.toLowerCase()}`;
    if (q) text += ` for “${q}”`;
    if (letter) text += ` starting with ${letter}`;
    return text;
  });

  readonly notes = computed(() => {
    const notes: string[] = [];
    const store = this.productsStore;
    const ingredientStatus = store.ingredientStatus();
    if (ingredientStatus === 'loading')
      notes.push('Checking the full catalogue too…');
    if (ingredientStatus === 'error')
      notes.push(
        "Couldn't check the full catalogue just now, so these are the first name matches only."
      );
    if (store.status() !== 'ready') return notes;

    const { q, letter, spirit } = toQuery(this.filters());
    const catalogue = store.catalogueStatus();
    const catalogueLoaded = catalogue === 'ready' || catalogue === 'partial';
    // The whole list and A–Z grow once the browser has the full catalogue.
    const browsing = !q && !spirit;
    if (browsing && !catalogueLoaded && catalogue !== 'error')
      notes.push('Loading the rest of the catalogue…');

    if (browsing && !letter && catalogueLoaded) {
      const sources = [...new Set(store.recipes().map(r => r.source))].map(
        source => SOURCE_NAMES[source]
      );
      const capped = store.cappedLetters();
      notes.push(
        `Every drink we can reach from ${listOf(sources)}.` +
          (capped.length
            ? ` The free API caps some lists, so there may be more drinks starting with ${listOf(capped)}. Search by name to find them.`
            : '')
      );
    }
    if (letter) {
      // Without the catalogue's page for this letter, a full page from TheCocktailDB
      // is the sign of a cap.
      const pageLoaded =
        catalogueLoaded && !store.failedLetters().includes(letter);
      const fromApi = store
        .recipes()
        .filter(r => r.source === 'cocktaildb' && startsWithLetter(r, letter));
      const capped = pageLoaded
        ? store.cappedLetters().includes(letter)
        : fromApi.length >= LETTER_PAGE_CAP;
      if (capped)
        notes.push(
          `The free API only lists some drinks starting with ${letter}, so there may be more. Search by name to find them.`
        );
    }
    if (this.spirit())
      notes.push(
        'Spirit filters can only check drinks the free API gives ingredients for.'
      );
    const hidden = this.curated().hidden;
    if (hidden)
      notes.push(
        `${hidden} incomplete or duplicate ${hidden === 1 ? 'recipe is' : 'recipes are'} left off the menu.`
      );
    return notes;
  });

  /** Which part of the catalogue is missing, when some of it failed to load. */
  readonly catalogueGap = computed(() => {
    const store = this.productsStore;
    if (store.status() !== 'ready') return '';
    const status = store.catalogueStatus();
    if (status === 'error')
      return "Couldn't load the rest of the catalogue just now.";
    if (status !== 'partial') return '';
    const letters = store.failedLetters();
    if (!letters.length) return "Couldn't load part of the catalogue just now.";
    // Past a handful, a list of letters is harder to read than a count.
    const missing =
      letters.length > MAX_LISTED_LETTERS
        ? `drinks for ${letters.length} of the ${CATALOGUE_PAGES} letters and digits`
        : `drinks starting with ${listOf(letters)}`;
    return store.failedLists()
      ? `Couldn't load part of the catalogue just now, including ${missing}.`
      : `Couldn't load ${missing} just now.`;
  });

  readonly emptyHint = computed(() => {
    const { q, type, spirit } = this.filters();
    if (q)
      return "Try a spirit like gin, or an ingredient like lime or mint. Our drinks source doesn't cover every ingredient yet.";
    if (type !== 'both' || spirit)
      return 'Loosening a filter might turn something up.';
    return 'Try another letter, or search by name.';
  });

  ngOnInit(): void {
    // Type, and letter or spirit alongside a search, are filtered locally.
    this.productsStore.loadDrinks(
      this.route.queryParamMap.pipe(
        map(params => toQuery(parseFilters(params, this.spirits))),
        distinctUntilChanged(sameQuery)
      )
    );
  }

  setQuery(q: string): void {
    // Typing replaces the history entry instead of adding one per keystroke.
    this.updateParams({ q: q || null }, true);
  }

  setLetter(letter: string): void {
    this.updateParams({ letter: letter || null });
  }

  setType(type: DrinkType): void {
    this.updateParams({ type: type === 'both' ? null : type });
  }

  setSpirit(spirit: string): void {
    this.updateParams({ spirit: spirit || null });
  }

  clearAll(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  retry(): void {
    this.productsStore.loadDrinks(toQuery(this.filters()));
  }

  private updateParams(queryParams: Params, replaceUrl = false): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  private describe(recipe: Recipe, q: string): string {
    const spirit = this.spirit();
    const ingredient =
      (q && matchedIngredient(recipe, q)) ||
      (spirit && spiritIngredient(recipe, spirit));
    // Venue drinks sit in the catalogue like any other; their section stands in for a glass.
    const extra = ingredient
      ? `with ${ingredient.toLowerCase()}`
      : recipe.source === 'venue-menu'
        ? recipe.category
        : recipe.glass;
    return [drinkLabel(recipe), extra].filter(Boolean).join(' · ');
  }
}
