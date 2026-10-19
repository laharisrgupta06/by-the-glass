import { Component, EventEmitter, Input, Output, signal } from '@angular/core';

import { ProductCardComponent } from '../../../products/components/product-card/product-card.component';
import { Recipe } from '../../../products/models/recipe.model';
import { LoadStatus } from '../../../products/store/product.store';
import { drinkLabel } from '../../../products/utils/drink-filters';
import { CabinetGaps, hasGaps } from '../../store/cabinet.store';
import { CabinetMatch, CabinetResults, Stand } from '../../utils/cabinet';

/** Near matches can run into the hundreds; the closest are shown first. */
export const ALMOST_SHOWN = 24;

@Component({
  selector: 'app-cabinet-results',
  standalone: true,
  imports: [ProductCardComponent],
  templateUrl: './cabinet-results.component.html',
  styleUrl: './cabinet-results.component.scss',
})
export class CabinetResultsComponent {
  @Input() status: LoadStatus = 'idle';
  @Input() set results(value: CabinetResults | null) {
    this.current = value;
    this.showAllAlmost.set(false);
  }
  get results(): CabinetResults | null {
    return this.current;
  }
  private current: CabinetResults | null = null;
  /** The person's own ingredients, which no recipe of ours uses (labels as typed). */
  @Input() own: string[] = [];
  /** Parts of the catalogue that didn't load, so there may be more matches. */
  @Input() gaps: CabinetGaps | null = null;
  @Input() labels = new Map<string, string>();
  /** The ingredient that would finish the most near matches. */
  @Input() next: { key: string; count: number } | undefined;
  /** e.g. "cocktails" or "sour mocktails", for honest summary copy. */
  @Input() noun = 'drinks';
  /** Whether a type or taste is narrowing results, so the empty state can say so. */
  @Input() narrowed = false;

  @Output() add = new EventEmitter<string>();
  @Output() retry = new EventEmitter<void>();
  @Output() widen = new EventEmitter<void>();

  readonly skeletons = Array.from({ length: 6 }, (_, i) => i);
  readonly almostShown = ALMOST_SHOWN;
  readonly showAllAlmost = signal(false);

  almostVisible(almost: CabinetMatch[]): CabinetMatch[] {
    return this.showAllAlmost() ? almost : almost.slice(0, ALMOST_SHOWN);
  }

  /** Says what couldn't be checked; empty when everything loaded. */
  gapNote(): string {
    const gaps = this.gaps;
    if (!gaps || !hasGaps(gaps)) return '';
    const plural = (n: number, one: string, many: string) =>
      `${n} ${n === 1 ? one : many}`;
    const parts: string[] = [];
    if (gaps.missingDetails)
      parts.push(
        `ingredients for ${plural(gaps.missingDetails, 'drink', 'drinks')}`
      );
    if (gaps.failedLetters.length)
      parts.push(
        `${plural(gaps.failedLetters.length, 'letter', 'letters')} of the catalogue`
      );
    if (gaps.failedLists) parts.push('part of the drinks list');
    return `We couldn't load everything just now (${listOf(parts)}), so there may be more matches.`;
  }

  ownList(): string {
    return listOf(this.own.map(o => `“${o}”`));
  }

  label(key: string): string {
    return this.labels.get(key) ?? key;
  }

  /** "Cocktail · Highball glass"; venue drinks name their section instead. */
  detail(recipe: Recipe): string {
    const extra =
      recipe.source === 'venue-menu' ? recipe.category : recipe.glass;
    return [drinkLabel(recipe), extra].filter(Boolean).join(' · ');
  }

  /** Every ingredient still needed, e.g. "Missing: Strawberries and Apple juice". */
  missing(match: CabinetMatch): string {
    const names = match.missing.map(m => this.labels.get(m.key) ?? m.name);
    return names.length ? `Missing: ${listOf(names)}` : '';
  }

  /** "Your lime counts as lime juice." Only for rules actually used by the drinks shown. */
  standsNote(): string {
    const stands: Stand[] = (this.results?.ready ?? []).flatMap(m => m.stands);
    const byHave = new Map<string, Set<string>>();
    for (const { have, need } of stands)
      byHave.set(have, (byHave.get(have) ?? new Set()).add(need));
    return [...byHave.entries()]
      .map(
        ([have, needs]) =>
          `Your ${this.lower(have)} counts as ${[...needs].map(n => this.lower(n)).join(' and ')}.`
      )
      .join(' ');
  }

  private lower(key: string): string {
    return this.label(key).toLowerCase();
  }
}

/** ["a", "b", "c"] → "a, b and c". */
function listOf(items: string[]): string {
  return items.length < 2
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
