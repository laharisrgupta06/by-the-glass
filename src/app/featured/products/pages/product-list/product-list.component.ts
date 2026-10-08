import { Component, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';

import { DrinkFiltersComponent } from '../../components/drink-filters/drink-filters.component';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { PRODUCT_LIST_CONFIG_DATA } from '../../config/product.config';
import { curate } from '../../data/recipe-quality';
import { SPIRIT_TAXONOMY } from '../../data/spirit-taxonomy';
import { Recipe } from '../../models/recipe.model';
import { ProductsStore } from '../../store/product.store';
import {
  DrinkQuery,
  DrinkType,
  byName,
  kindLabel,
  matchedIngredient,
  matchesType,
  parseFilters,
  spiritIngredient,
  startsWithLetter,
  toQuery,
} from '../../utils/drink-filters';

// Free-key caps on TheCocktailDB list endpoints, used to explain short lists honestly.
const BROWSE_LIST_CAP = 100;
const LETTER_CAP = 25;

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

  /** Loaded recipes minus incomplete, trivial and duplicate ones. */
  private readonly curated = computed(() =>
    curate(this.productsStore.recipes())
  );

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
    const ingredientStatus = this.productsStore.ingredientStatus();
    if (ingredientStatus === 'loading') notes.push('Checking ingredients too…');
    if (ingredientStatus === 'error')
      notes.push(
        "Couldn't check ingredients just now, so these are name matches only."
      );
    if (this.productsStore.status() !== 'ready') return notes;

    const { q, letter, spirit } = toQuery(this.filters());
    const loaded = this.productsStore.recipes();
    const browsing = !q && !letter && !spirit;
    if (browsing && this.filters().type !== 'mocktail') {
      const cocktails = loaded.filter(r => r.kind === 'cocktail');
      if (cocktails.length >= BROWSE_LIST_CAP)
        notes.push(
          'This list stops at 100 cocktails. Pick a letter, a spirit or search to find the rest.'
        );
    }
    if (letter && loaded.length >= LETTER_CAP)
      notes.push(
        `We can only show the first ${LETTER_CAP} drinks under ${letter}. Search by name to find more.`
      );
    const hidden = this.curated().hidden;
    if (hidden)
      notes.push(
        `${hidden} incomplete or duplicate ${hidden === 1 ? 'recipe is' : 'recipes are'} left off the menu.`
      );
    return notes;
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
    const extra = ingredient
      ? `with ${ingredient.toLowerCase()}`
      : recipe.glass;
    return [kindLabel(recipe.kind), extra].filter(Boolean).join(' · ');
  }
}
