import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';

import { SpiritDefinition } from '../../data/spirit-taxonomy';
import {
  DrinkType,
  LETTERS,
  MIN_QUERY_LENGTH,
} from '../../utils/drink-filters';

@Component({
  selector: 'app-drink-filters',
  standalone: true,
  templateUrl: './drink-filters.component.html',
  styleUrl: './drink-filters.component.scss',
})
export class DrinkFiltersComponent {
  @Input() letter = '';
  @Input() type: DrinkType = 'both';
  @Input() spirit = '';
  @Input() spirits: SpiritDefinition[] = [];
  @Input() set query(value: string) {
    // Don't overwrite what's being typed when the URL catches up with it.
    if (value !== this.text().trim()) this.text.set(value);
  }

  @Output() queryChange = new EventEmitter<string>();
  @Output() letterChange = new EventEmitter<string>();
  @Output() typeChange = new EventEmitter<DrinkType>();
  @Output() spiritChange = new EventEmitter<string>();

  readonly text = signal('');
  readonly letters = LETTERS;
  readonly types: { value: DrinkType; label: string }[] = [
    { value: 'both', label: 'Both' },
    { value: 'cocktail', label: 'Cocktails' },
    { value: 'mocktail', label: 'Mocktails' },
  ];

  private typed$ = new Subject<string>();

  constructor() {
    this.typed$
      .pipe(debounceTime(400), takeUntilDestroyed())
      // Ignore stale input if Clear was clicked while debouncing.
      .subscribe(value => value === this.text() && this.emitQuery(value));
  }

  onInput(value: string): void {
    this.text.set(value);
    this.typed$.next(value);
  }

  submit(event: Event): void {
    event.preventDefault();
    this.emitQuery(this.text());
  }

  clear(): void {
    this.text.set('');
    this.queryChange.emit('');
  }

  private emitQuery(value: string): void {
    const q = value.trim();
    // A single character matches almost everything, so wait for a second one.
    if (q.length === 0 || q.length >= MIN_QUERY_LENGTH)
      this.queryChange.emit(q);
  }
}
