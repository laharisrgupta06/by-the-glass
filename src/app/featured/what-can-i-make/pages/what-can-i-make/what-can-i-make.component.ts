import {
  Component,
  ElementRef,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { map } from 'rxjs';

import { cleanTerm } from 'src/app/core/ai/ingredient-interpretation';
import {
  INGREDIENT_RULES,
  ingredientKey,
} from '../../../products/data/ingredient-rules';
import { DrinkType } from '../../../products/utils/drink-filters';
import { BartenderPanelComponent } from '../../components/bartender-panel/bartender-panel.component';
import { CabinetResultsComponent } from '../../components/cabinet-results/cabinet-results.component';
import { PourAnimationComponent } from '../../components/pour-animation/pour-animation.component';
import { IngredientPickerComponent } from '../../components/ingredient-picker/ingredient-picker.component';
import { IngredientShelvesComponent } from '../../components/ingredient-shelves/ingredient-shelves.component';
import {
  SurprisePanelComponent,
  SurpriseState,
} from '../../components/surprise-panel/surprise-panel.component';
import { INGREDIENT_CATEGORIES } from '../../data/ingredient-categories';
import { TASTE_SIGNALS, Taste } from '../../data/taste-signals';
import { CabinetStore } from '../../store/cabinet.store';
import {
  MAX_INGREDIENTS,
  addIngredient,
  bestNextIngredient,
  buildIngredientIndex,
  matchCabinet,
  parseCabinetParams,
  removeIngredient,
  typedLabels,
} from '../../utils/cabinet';
import { pickSurprise, surpriseKey, surprisePool } from '../../utils/surprise';

const NOUNS: Record<DrinkType, string> = {
  both: 'drinks',
  cocktail: 'cocktails',
  mocktail: 'mocktails',
};

const SINGULAR: Record<DrinkType, string> = {
  both: 'drink',
  cocktail: 'cocktail',
  mocktail: 'mocktail',
};

@Component({
  selector: 'app-what-can-i-make',
  standalone: true,
  imports: [
    IngredientPickerComponent,
    CabinetResultsComponent,
    IngredientShelvesComponent,
    SurprisePanelComponent,
    BartenderPanelComponent,
    PourAnimationComponent,
  ],
  templateUrl: './what-can-i-make.component.html',
  styleUrl: './what-can-i-make.component.scss',
})
export class WhatCanIMakeComponent implements OnInit {
  readonly store = inject(CabinetStore);
  readonly tastes = inject(TASTE_SIGNALS);
  readonly categories = inject(INGREDIENT_CATEGORIES);
  private rules = inject(INGREDIENT_RULES);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  @ViewChild(IngredientPickerComponent) picker?: IngredientPickerComponent;
  @ViewChild('resultsHeading') resultsHeading?: ElementRef<HTMLElement>;
  @ViewChild(SurprisePanelComponent) surprisePanel?: SurprisePanelComponent;

  readonly reduceMotion =
    this.isBrowser && matchMedia('(prefers-reduced-motion: reduce)').matches;

  readonly types: { value: DrinkType; label: string }[] = [
    { value: 'both', label: 'Both' },
    { value: 'cocktail', label: 'Cocktails' },
    { value: 'mocktail', label: 'Mocktails' },
  ];

  /**
   * The cabinet lives in the URL (?i=gin&i=lime+juice&type=…&taste=…), so a refresh or
   * a trip to a drink and back keeps it. Edits replace the history entry rather than
   * adding one per ingredient.
   */
  readonly params = toSignal(
    this.route.queryParamMap.pipe(
      map(params =>
        parseCabinetParams(
          params,
          this.tastes.map(t => t.id)
        )
      )
    ),
    { requireSync: true }
  );

  /** Ingredients as typed in the URL, for ones our drinks don't use ("Mogu Mogu"). */
  readonly typed = toSignal(this.route.queryParamMap.pipe(map(typedLabels)), {
    requireSync: true,
  });

  /** Results show once asked for, or straight away when arriving with a cabinet in the URL. */
  private readonly revealed = signal(this.params().have.length > 0);
  readonly showMissing = signal(false);

  readonly index = computed(() =>
    buildIngredientIndex(this.store.recipes(), this.rules)
  );
  private readonly knownLabels = computed(
    () => new Map(this.index().map(o => [o.key, o.label]))
  );
  /** Our label for every ingredient, or the person's own spelling for ones we don't use. */
  readonly labels = computed(() => {
    const labels = new Map(this.typed());
    for (const [key, label] of this.knownLabels()) labels.set(key, label);
    return labels;
  });

  /**
   * Everything in the cabinet, including ingredients none of our drinks use: those are
   * kept as they are (never swapped for something similar) for the AI bartender.
   */
  readonly have = computed(() => this.params().have);

  /** Every ingredient in the cabinet as labelled on the page, for the AI Bartender. */
  readonly haveLabels = computed(() =>
    this.have().map(key => this.labels().get(key) ?? key)
  );

  readonly ownLabels = computed(() =>
    this.ownIngredients().map(key => this.labels().get(key) ?? key)
  );

  /** The person's own ingredients, which no recipe of ours uses. */
  readonly ownIngredients = computed(() => {
    if (this.store.status() !== 'ready') return [];
    const known = this.knownLabels();
    return this.have().filter(key => !known.has(key));
  });

  readonly showResults = computed(
    () => this.revealed() && this.have().length > 0
  );

  readonly results = computed(() => {
    if (this.store.status() !== 'ready' || !this.have().length) return null;
    const { type, tastes } = this.params();
    return matchCabinet(
      this.store.recipes(),
      { have: this.have(), type, tastes },
      this.rules,
      this.tastes
    );
  });

  readonly next = computed(() =>
    bestNextIngredient(this.results()?.almost ?? [])
  );

  readonly pickedTastes = computed(() =>
    this.tastes.filter(t => this.params().tastes.includes(t.id))
  );

  readonly pickedTasteLabels = computed(() =>
    this.pickedTastes().map(t => t.label)
  );

  readonly noun = computed(() => {
    const tastes = this.pickedTastes().map(t => t.label.toLowerCase());
    return [...tastes, NOUNS[this.params().type]].join(' ');
  });

  readonly narrowed = computed(
    () => this.params().type !== 'both' || this.params().tastes.length > 0
  );

  /** The surprise drink's id lives in the URL too (?surprise=11007), so a refresh keeps it. */
  readonly surpriseId = toSignal(
    this.route.queryParamMap.pipe(map(params => params.get('surprise'))),
    { requireSync: true }
  );
  /** Asked for before the drinks list loaded; picked as soon as it's ready. */
  private readonly surprisePending = signal(false);
  /** Set when the chosen type has nothing complete enough to show. */
  private readonly surpriseEmpty = signal(false);
  /** Recent picks, so "another" doesn't repeat itself. */
  private recentSurprises: string[] = [];
  readonly surpriseAnnouncement = signal('');

  readonly surpriseNoun = computed(() => SINGULAR[this.params().type]);

  readonly surpriseRecipe = computed(() => {
    const id = this.surpriseId();
    return id
      ? this.store.recipes().find(r => r.id === id && r.hasDetails) ?? null
      : null;
  });

  /** Null while there's no surprise to show. */
  readonly surpriseState = computed<SurpriseState | null>(() => {
    const asked =
      this.surprisePending() || this.surpriseEmpty() || !!this.surpriseId();
    if (!asked) return null;
    const status = this.store.status();
    if (status === 'error') return 'error';
    if (status !== 'ready' || this.surprisePending()) return 'loading';
    if (this.surpriseEmpty()) return 'empty';
    return this.surpriseRecipe() ? 'ready' : 'missing';
  });

  constructor() {
    // Finish a surprise asked for while the drinks were still loading.
    effect(
      () => {
        if (this.surprisePending() && this.store.status() === 'ready') {
          this.surprisePending.set(false);
          this.pickSurprise();
        }
      },
      { allowSignalWrites: true }
    );
  }

  ngOnInit(): void {
    this.store.load();
  }

  addIngredient(key: string): void {
    this.showMissing.set(false);
    const have = addIngredient(this.have(), key).slice(0, MAX_INGREDIENTS);
    this.update({ i: this.urlValues(have) });
  }

  /** Adds something our drinks don't use, exactly as typed ("Mogu Mogu"). */
  addOwnIngredient(text: string): void {
    const label = cleanTerm(text);
    const key = ingredientKey(label ?? '');
    if (!label || !key) return;
    this.showMissing.set(false);
    const have = addIngredient(this.have(), key).slice(0, MAX_INGREDIENTS);
    this.update({ i: this.urlValues(have, new Map([[key, label]])) });
  }

  removeIngredient(key: string): void {
    const have = removeIngredient(this.have(), key);
    this.update({ i: have.length ? this.urlValues(have) : null });
  }

  clearIngredients(): void {
    this.revealed.set(false);
    this.update({ i: null });
  }

  setType(type: DrinkType): void {
    this.update({ type: type === 'both' ? null : type });
  }

  toggleTaste(taste: Taste): void {
    const tastes = this.params().tastes;
    const next = tastes.includes(taste)
      ? tastes.filter(t => t !== taste)
      : [...tastes, taste];
    this.update({ taste: next.length ? next.join(',') : null });
  }

  widen(): void {
    this.update({ type: null, taste: null });
  }

  find(): void {
    if (!this.have().length) {
      this.showMissing.set(true);
      this.picker?.focus();
      return;
    }
    this.revealed.set(true);
    // Bring the results into view and move focus there so they're announced.
    setTimeout(() =>
      this.resultsHeading?.nativeElement.scrollIntoView({
        behavior: this.reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      })
    );
    setTimeout(() =>
      this.resultsHeading?.nativeElement.focus({ preventScroll: true })
    );
  }

  retry(): void {
    this.store.load();
  }

  /** Picks a random complete drink of the chosen type. Works again and again in place. */
  surprise(): void {
    this.surpriseEmpty.set(false);
    const status = this.store.status();
    if (status === 'ready') {
      this.pickSurprise();
      return;
    }
    this.surprisePending.set(true);
    if (status === 'error') this.store.load();
    this.revealSurprise(true);
  }

  closeSurprise(): void {
    this.surprisePending.set(false);
    this.surpriseEmpty.set(false);
    this.update({ surprise: null });
  }

  retrySurprise(): void {
    this.surprisePending.set(true);
    this.store.load();
  }

  private pickSurprise(): void {
    const pool = surprisePool(this.store.recipes(), this.params().type);
    const current = this.surpriseRecipe();
    const recent = current
      ? [...this.recentSurprises, surpriseKey(current)]
      : this.recentSurprises;
    const pick = pickSurprise(pool, recent);
    if (!pick) {
      this.surpriseEmpty.set(true);
      this.update({ surprise: null });
      this.revealSurprise(true);
      return;
    }
    const firstReveal = !this.surpriseId();
    this.recentSurprises = [...recent, surpriseKey(pick)].slice(-20);
    this.surpriseAnnouncement.set(`Your surprise: ${pick.name}.`);
    this.update({ surprise: pick.id });
    this.revealSurprise(firstReveal);
  }

  /** Scroll to the panel the first time; keep the place for "another". */
  private revealSurprise(scroll: boolean): void {
    setTimeout(() => this.surprisePanel?.focus(scroll, !this.reduceMotion));
  }

  /** Our ingredients go in the URL by key; the person's own keep their spelling. */
  private urlValues(
    have: string[],
    extra = new Map<string, string>()
  ): string[] {
    const known = this.knownLabels();
    return have.map(key =>
      known.has(key) ? key : extra.get(key) ?? this.typed().get(key) ?? key
    );
  }

  private update(queryParams: Params): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
