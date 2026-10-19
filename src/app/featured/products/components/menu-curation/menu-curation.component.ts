import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  Output,
  PLATFORM_ID,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';

import { InterpretFailure } from 'src/app/core/ai/ai-failure';
import { MenuIllustration, StoredMenuRecipe } from 'src/app/core/ai/ai-recipe';
import { MenuExtrasService } from '../../data/venue-menu/menu-extras.service';
import { Recipe } from '../../models/recipe.model';

/** Failures where asking again can help. */
const RETRYABLE = [
  'busy',
  'quota',
  'rate-limited',
  'timeout',
  'offline',
  'failed',
];

type State =
  | { kind: 'loading' }
  /** No stored recipe, and none can be made right now. */
  | { kind: 'unavailable' }
  /** No stored recipe; one can be suggested on request. */
  | { kind: 'none' }
  | { kind: 'creating' }
  | { kind: 'failed'; reason: InterpretFailure }
  | { kind: 'ready' };

/**
 * The Method column of a venue drink that has no stored recipe. Loads what our server
 * has for the drink: a stored recipe is handed to the page (which shows it in the usual
 * layout), as is an illustration. Without one it says so once, plainly, and can ask for
 * an approximate recipe; nothing is invented here.
 */
@Component({
  selector: 'app-menu-curation',
  standalone: true,
  templateUrl: './menu-curation.component.html',
  styleUrl: './menu-curation.component.scss',
})
export class MenuCurationComponent {
  private extras = inject(MenuExtrasService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private request?: Subscription;
  private drinkId = '';

  @Input({ required: true }) set drink(value: Recipe) {
    if (value.id === this.drinkId) return;
    this.drinkId = value.id;
    this.load();
  }
  @Output() recipe = new EventEmitter<StoredMenuRecipe>();
  @Output() illustration = new EventEmitter<MenuIllustration | null>();

  readonly state = signal<State>({ kind: 'loading' });
  readonly devMode = isDevMode();
  readonly retryable = (code: string) => RETRYABLE.includes(code);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  create(): void {
    if (this.state().kind === 'creating') return;
    this.state.set({ kind: 'creating' });
    this.request?.unsubscribe();
    this.request = this.extras.createRecipe(this.drinkId).subscribe({
      next: stored => this.found(stored),
      error: (reason: InterpretFailure) =>
        this.state.set({ kind: 'failed', reason }),
    });
  }

  private load(): void {
    this.request?.unsubscribe();
    this.illustration.emit(null);
    if (!this.isBrowser) return;
    this.state.set({ kind: 'loading' });
    this.request = this.extras.extras(this.drinkId).subscribe({
      next: extras => {
        this.illustration.emit(extras.illustration);
        if (extras.recipe) this.found(extras.recipe);
        else
          this.state.set({
            kind: extras.canCreateRecipe ? 'none' : 'unavailable',
          });
      },
      error: () => this.state.set({ kind: 'unavailable' }),
    });
  }

  private found(stored: StoredMenuRecipe): void {
    this.state.set({ kind: 'ready' });
    this.recipe.emit(stored);
  }
}
