import {
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';

import { cleanTerm } from 'src/app/core/ai/ingredient-interpretation';
import { ingredientKey } from '../../../products/data/ingredient-rules';
import { LoadStatus } from '../../../products/store/product.store';
import { IngredientInterpreterService } from '../../data/ingredient-interpreter.service';
import { IngredientOption, suggestIngredients } from '../../utils/cabinet';
import { IngredientAssistComponent } from '../ingredient-assist/ingredient-assist.component';

/** "Lime juice" with the typed part picked out, when it starts a word. */
interface Highlighted {
  option: IngredientOption;
  before: string;
  match: string;
  after: string;
}

@Component({
  selector: 'app-ingredient-picker',
  standalone: true,
  imports: [IngredientAssistComponent],
  templateUrl: './ingredient-picker.component.html',
  styleUrl: './ingredient-picker.component.scss',
  animations: [
    trigger('chip', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.94)' }),
        animate('160ms ease-out', style({ opacity: 1, transform: 'none' })),
      ]),
      transition(':leave', [
        animate(
          '120ms ease-in',
          style({ opacity: 0, transform: 'scale(0.94)' })
        ),
      ]),
    ]),
  ],
})
export class IngredientPickerComponent {
  private optionsSignal = signal<IngredientOption[]>([]);
  private selectedSignal = signal<string[]>([]);
  private statusSignal = signal<LoadStatus>('idle');
  private extraLabels = signal(new Map<string, string>());

  @Input() set options(value: IngredientOption[]) {
    this.optionsSignal.set(value);
  }
  @Input() set selected(value: string[]) {
    this.selectedSignal.set(value);
  }
  /** Where the ingredient list is: suggestions need it loaded. */
  @Input() set status(value: LoadStatus) {
    this.statusSignal.set(value);
  }
  /** Labels for chips our options don't cover: the person's own ingredients. */
  @Input() set customLabels(value: Map<string, string>) {
    this.extraLabels.set(value);
  }
  @Input() invalid = false;
  @HostBinding('@.disabled') @Input() reduceMotion = false;

  @Output() add = new EventEmitter<string>();
  /** An ingredient none of our drinks use, as typed. */
  @Output() addOwn = new EventEmitter<string>();
  @Output() remove = new EventEmitter<string>();
  @Output() clear = new EventEmitter<void>();

  @ViewChild('input', { static: true }) input!: ElementRef<HTMLInputElement>;

  readonly text = signal('');
  readonly active = signal(0);
  readonly expanded = signal(false);
  /** Spoken confirmation of adds and removals. */
  readonly announcement = signal('');

  private readonly labels = computed(
    () => new Map(this.optionsSignal().map(o => [o.key, o.label]))
  );

  readonly suggestions = computed<Highlighted[]>(() => {
    const text = this.text().trim();
    return suggestIngredients(
      this.optionsSignal(),
      text,
      this.selectedSignal()
    ).map(option => highlight(option, text));
  });

  readonly open = computed(
    () => this.expanded() && this.suggestions().length > 0
  );

  readonly chips = computed(() =>
    this.selectedSignal().map(key => ({ key, label: this.labelFor(key) }))
  );

  readonly hint = computed(() => {
    const text = this.text().trim();
    const status = this.statusSignal();
    if (status === 'error') return "The ingredient list didn't load.";
    if (!text) return 'Ice and water are on the house.';
    if (status !== 'ready') return 'Stocking the shelves…';
    if (this.selectedSignal().includes(ingredientKey(text)))
      return `${this.labelFor(ingredientKey(text))} is already in.`;
    if (this.suggestions().length) return '';
    return `None of our drinks use “${text}” yet.`;
  });

  /**
   * A typed ingredient our drinks don't use, which Gemini can be asked about. Only
   * when the database has no match: database matching always comes first.
   */
  readonly assistTerm = computed(() => {
    const text = this.text().trim();
    if (!text || !this.interpreter.available()) return null;
    if (this.statusSignal() !== 'ready' || this.suggestions().length)
      return null;
    return this.selectedSignal().includes(ingredientKey(text)) ? null : text;
  });

  /**
   * Something none of our drinks use can still go in the cabinet as it is, for the AI
   * bartender. It's never swapped for a similar ingredient.
   */
  readonly ownTerm = computed(() => {
    const text = cleanTerm(this.text());
    if (!text || this.statusSignal() !== 'ready') return null;
    if (this.suggestions().length) return null;
    return this.selectedSignal().includes(ingredientKey(text)) ? null : text;
  });

  readonly options$ = this.optionsSignal.asReadonly();
  readonly selected$ = this.selectedSignal.asReadonly();

  private interpreter = inject(IngredientInterpreterService);

  constructor() {
    this.interpreter.checkAvailability();
  }

  labelFor(key: string): string {
    return (
      this.labels().get(key) ??
      this.extraLabels().get(key) ??
      key.charAt(0).toUpperCase() + key.slice(1)
    );
  }

  /** Whether a chip is one of the person's own ingredients. */
  isOwn(key: string): boolean {
    return !this.labels().has(key);
  }

  optionId(index: number): string {
    return `cabinet-option-${index}`;
  }

  onInput(value: string): void {
    this.text.set(value);
    this.active.set(0);
    this.expanded.set(true);
  }

  onKeydown(event: KeyboardEvent): void {
    const count = this.suggestions().length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        if (!count) return;
        event.preventDefault();
        if (!this.open()) {
          this.expanded.set(true);
          return;
        }
        this.active.update(
          i => (i + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
        );
        return;
      case 'Enter':
        if (!this.open()) {
          const own = this.ownTerm();
          if (own) {
            event.preventDefault();
            this.pickOwn(own);
          }
          return;
        }
        event.preventDefault();
        this.pick(this.suggestions()[this.active()].option);
        return;
      case 'Escape':
        if (this.open()) this.expanded.set(false);
        else this.text.set('');
        return;
    }
  }

  pick(option: IngredientOption): void {
    this.add.emit(option.key);
    this.announcement.set(`${option.label} added.`);
    this.text.set('');
    this.expanded.set(false);
    this.focus();
  }

  pickOwn(text: string): void {
    this.addOwn.emit(text);
    this.announcement.set(`${text} added as your own ingredient.`);
    this.text.set('');
    this.expanded.set(false);
    this.focus();
  }

  removeChip(chip: { key: string; label: string }): void {
    this.remove.emit(chip.key);
    this.announcement.set(`${chip.label} removed.`);
    this.focus();
  }

  clearAll(): void {
    this.clear.emit();
    this.announcement.set('All ingredients cleared.');
    this.focus();
  }

  focus(): void {
    this.input.nativeElement.focus();
  }
}

function highlight(option: IngredientOption, text: string): Highlighted {
  const label = option.label;
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // The typed text where it starts a word: "lime" in "Lemon-lime soda".
  const found =
    escaped && new RegExp(`(^|[^\\p{L}])(${escaped})`, 'iu').exec(label);
  if (!found) return { option, before: label, match: '', after: '' };
  const at = found.index + found[1].length;
  const query = found[2];
  return {
    option,
    before: label.slice(0, at),
    match: label.slice(at, at + query.length),
    after: label.slice(at + query.length),
  };
}
