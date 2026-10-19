import {
  Component,
  DestroyRef,
  ElementRef,
  Input,
  ViewChild,
  computed,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';

import { InterpretFailure } from 'src/app/core/ai/ai-failure';
import { BartenderAnswer } from 'src/app/core/ai/ai-recipe';
import { SavedRecipesService } from 'src/app/core/saved-recipes/saved-recipes.service';
import { AiRecipeCardComponent } from '../../../products/components/ai-recipe-card/ai-recipe-card.component';
import { DrinkType } from '../../../products/utils/drink-filters';
import { BartenderService } from '../../data/bartender.service';
import { IngredientInterpreterService } from '../../data/ingredient-interpreter.service';

const SLOW_AFTER_MS = 10_000;
const RETRYABLE = [
  'busy',
  'quota',
  'rate-limited',
  'timeout',
  'offline',
  'failed',
];

type State =
  | { kind: 'idle' }
  | { kind: 'creating' }
  | { kind: 'ready'; answer: BartenderAnswer }
  | { kind: 'failed'; reason: InterpretFailure };

export const BARTENDER_DISCLAIMER =
  'Created by AI (Gemini) from your ingredients, with approximate amounts. It isn’t one of our catalogue recipes, so taste as you go.';

/**
 * "Ask AI Bartender to Create a Drink": a new drink from the cabinet's ingredients,
 * exactly as named (Mogu Mogu stays Mogu Mogu), even when no catalogue recipe matches.
 */
@Component({
  selector: 'app-bartender-panel',
  standalone: true,
  imports: [AiRecipeCardComponent],
  templateUrl: './bartender-panel.component.html',
  styleUrl: './bartender-panel.component.scss',
})
export class BartenderPanelComponent {
  private bartender = inject(BartenderService);
  private interpreter = inject(IngredientInterpreterService);
  readonly saved = inject(SavedRecipesService);
  private request?: Subscription;
  private slowTimer?: ReturnType<typeof setTimeout>;

  /** The cabinet, as the page labels it. */
  @Input() ingredients: string[] = [];
  @Input() type: DrinkType = 'both';
  /** Picked taste labels, e.g. ["Sour"]. */
  @Input() tastes: string[] = [];

  @ViewChild('result') result?: ElementRef<HTMLElement>;

  readonly state = signal<State>({ kind: 'idle' });
  readonly slow = signal(false);
  readonly needIngredients = signal(false);
  readonly available = this.interpreter.available;
  readonly devMode = isDevMode();
  readonly disclaimer = BARTENDER_DISCLAIMER;
  readonly retryable = (code: string) => RETRYABLE.includes(code);

  readonly answer = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.answer : null;
  });
  readonly failure = computed(() => {
    const state = this.state();
    return state.kind === 'failed' ? state.reason : null;
  });
  /** Ingredients the recipe needs that the person didn't list. */
  readonly needed = computed(() =>
    (this.answer()?.recipe.ingredients ?? [])
      .filter(i => i.origin === 'extra' && !i.optional)
      .map(i => i.name)
  );

  constructor() {
    this.interpreter.checkAvailability();
    inject(DestroyRef).onDestroy(() => {
      this.request?.unsubscribe();
      clearTimeout(this.slowTimer);
    });
  }

  create(): void {
    if (this.state().kind === 'creating') return;
    if (!this.ingredients.length) {
      this.needIngredients.set(true);
      return;
    }
    this.needIngredients.set(false);
    this.state.set({ kind: 'creating' });
    this.slow.set(false);
    clearTimeout(this.slowTimer);
    this.slowTimer = setTimeout(() => this.slow.set(true), SLOW_AFTER_MS);
    this.request?.unsubscribe();
    this.request = this.bartender
      .create({
        ingredients: this.ingredients,
        type: this.type,
        tastes: this.tastes,
      })
      .subscribe({
        next: answer => this.finish({ kind: 'ready', answer }),
        error: (reason: InterpretFailure) =>
          this.finish({ kind: 'failed', reason }),
      });
  }

  save(answer: BartenderAnswer): void {
    void this.saved.save(answer.recipe, answer.basedOn);
  }

  waitText(seconds: number | undefined): string {
    if (!seconds) return 'a minute';
    if (seconds < 90) return `about ${seconds} seconds`;
    // A used-up daily quota can mean most of a day.
    if (seconds < 90 * 60) return `about ${Math.round(seconds / 60)} minutes`;
    return `about ${Math.round(seconds / 3600)} hours`;
  }

  list(items: string[]): string {
    return items.length < 2
      ? items.join('')
      : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
  }

  private finish(state: State): void {
    clearTimeout(this.slowTimer);
    this.slow.set(false);
    this.state.set(state);
    if (state.kind === 'ready')
      setTimeout(() =>
        this.result?.nativeElement.focus({ preventScroll: false })
      );
  }
}
