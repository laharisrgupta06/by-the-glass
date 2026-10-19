import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';

import {
  IngredientInterpretation,
  RELATION_LABELS,
} from 'src/app/core/ai/ingredient-interpretation';
import { ingredientKey } from '../../../products/data/ingredient-rules';
import {
  IngredientInterpreterService,
  InterpretFailure,
} from '../../data/ingredient-interpreter.service';
import { IngredientOption } from '../../utils/cabinet';

const SLOW_AFTER_MS = 8_000;

/** Failures where asking again can help. */
const RETRYABLE = [
  'busy',
  'quota',
  'rate-limited',
  'timeout',
  'offline',
  'failed',
];

type AssistState =
  | { kind: 'idle' }
  | { kind: 'asking' }
  | { kind: 'answered'; answer: IngredientInterpretation }
  | { kind: 'failed'; reason: InterpretFailure };

/**
 * For a typed ingredient our drinks don't use: ask Gemini (through our server) what it
 * is, and offer related ingredients that our drinks do use. Nothing is added unless
 * the person chooses it.
 */
@Component({
  selector: 'app-ingredient-assist',
  standalone: true,
  templateUrl: './ingredient-assist.component.html',
  styleUrl: './ingredient-assist.component.scss',
})
export class IngredientAssistComponent {
  private interpreter = inject(IngredientInterpreterService);
  private request?: Subscription;
  private termSignal = signal('');
  private optionsSignal = signal<IngredientOption[]>([]);
  private selectedSignal = signal<string[]>([]);

  @Input({ required: true }) set term(value: string) {
    if (value === this.termSignal()) return;
    // A different term starts over; an answer for the old one would mislead.
    this.request?.unsubscribe();
    this.termSignal.set(value);
    this.state.set({ kind: 'idle' });
  }
  @Input() set options(value: IngredientOption[]) {
    this.optionsSignal.set(value);
  }
  @Input() set selected(value: string[]) {
    this.selectedSignal.set(value);
  }

  @Output() add = new EventEmitter<IngredientOption>();

  readonly state = signal<AssistState>({ kind: 'idle' });
  readonly relationLabels = RELATION_LABELS;
  readonly retryable = (code: string) => RETRYABLE.includes(code);
  readonly displayTerm = this.termSignal.asReadonly();

  readonly answer = computed(() => {
    const state = this.state();
    return state.kind === 'answered' ? state.answer : null;
  });
  /** Shown as "Still thinking…" once an answer takes longer than usual. */
  readonly slow = signal(false);
  /** Development builds can name the command that starts the API. */
  readonly devMode = isDevMode();
  private slowTimer?: ReturnType<typeof setTimeout>;

  readonly failure = computed(() => {
    const state = this.state();
    return state.kind === 'failed' ? state.reason : null;
  });

  private readonly byKey = computed(
    () => new Map(this.optionsSignal().map(o => [o.key, o]))
  );

  /** Suggestions resolved to ingredients on the page; anything else is dropped. */
  readonly suggestions = computed(() => {
    const answer = this.answer();
    if (!answer) return [];
    return answer.suggestions.flatMap(s => {
      const option = this.byKey().get(ingredientKey(s.ingredient));
      return option
        ? [{ ...s, option, added: this.selectedSignal().includes(option.key) }]
        : [];
    });
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.request?.unsubscribe();
      clearTimeout(this.slowTimer);
    });
  }

  ask(): void {
    const vocabulary = this.optionsSignal().map(o => o.label);
    this.state.set({ kind: 'asking' });
    this.slow.set(false);
    clearTimeout(this.slowTimer);
    this.slowTimer = setTimeout(() => this.slow.set(true), SLOW_AFTER_MS);
    this.request?.unsubscribe();
    this.request = this.interpreter
      .interpret(this.termSignal(), vocabulary)
      .subscribe({
        next: answer => this.finish({ kind: 'answered', answer }),
        error: (reason: InterpretFailure) =>
          this.finish({ kind: 'failed', reason }),
      });
  }

  /** "about 45 seconds" / "about 2 minutes", for Retry-After waits. */
  waitText(seconds: number | undefined): string {
    if (!seconds) return 'a minute';
    if (seconds < 90) return `about ${seconds} seconds`;
    // A used-up daily quota can mean most of a day.
    if (seconds < 90 * 60) return `about ${Math.round(seconds / 60)} minutes`;
    return `about ${Math.round(seconds / 3600)} hours`;
  }

  private finish(state: AssistState): void {
    clearTimeout(this.slowTimer);
    this.slow.set(false);
    this.state.set(state);
  }
}
