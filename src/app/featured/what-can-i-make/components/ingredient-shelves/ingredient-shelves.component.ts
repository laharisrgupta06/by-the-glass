import {
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  signal,
} from '@angular/core';

import { IngredientCategory } from '../../data/ingredient-categories';
import {
  IngredientOption,
  IngredientShelf,
  shelveIngredients,
} from '../../utils/cabinet';

/** Browse ingredients by category: pick a shelf, then tap what you have. */
@Component({
  selector: 'app-ingredient-shelves',
  standalone: true,
  templateUrl: './ingredient-shelves.component.html',
  styleUrl: './ingredient-shelves.component.scss',
})
export class IngredientShelvesComponent {
  private optionsSignal = signal<IngredientOption[]>([]);
  private categoriesSignal = signal<IngredientCategory[]>([]);
  private selectedSignal = signal<string[]>([]);

  @Input() set options(value: IngredientOption[]) {
    this.optionsSignal.set(value);
  }
  @Input() set categories(value: IngredientCategory[]) {
    this.categoriesSignal.set(value);
  }
  @Input() set selected(value: string[]) {
    this.selectedSignal.set(value);
  }

  @Output() add = new EventEmitter<string>();
  @Output() remove = new EventEmitter<string>();

  /** The open shelf's category id, if any. */
  readonly openId = signal<string | null>(null);

  readonly shelves = computed(() =>
    shelveIngredients(this.optionsSignal(), this.categoriesSignal())
  );

  readonly open = computed(() =>
    this.shelves().find(s => s.category.id === this.openId())
  );

  private readonly picked = computed(() => new Set(this.selectedSignal()));

  isPicked(key: string): boolean {
    return this.picked().has(key);
  }

  /** How many of a shelf's ingredients are already in the cabinet. */
  pickedOn(shelf: IngredientShelf): number {
    return shelf.options.filter(o => this.picked().has(o.key)).length;
  }

  toggleShelf(id: string): void {
    this.openId.update(open => (open === id ? null : id));
  }

  toggle(option: IngredientOption): void {
    if (this.isPicked(option.key)) this.remove.emit(option.key);
    else this.add.emit(option.key);
  }

  panelId(id: string): string {
    return `shelf-${id}`;
  }
}
