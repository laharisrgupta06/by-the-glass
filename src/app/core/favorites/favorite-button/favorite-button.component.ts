import { Component, Input, computed, inject, signal } from '@angular/core';

import { FavoriteDrink } from '../favorite.model';
import { FavoritesService } from '../favorites.service';

@Component({
  selector: 'app-favorite-button',
  standalone: true,
  templateUrl: './favorite-button.component.html',
  styleUrl: './favorite-button.component.scss',
})
export class FavoriteButtonComponent {
  private favorites = inject(FavoritesService);
  private drinkSignal = signal<FavoriteDrink | null>(null);

  @Input({ required: true }) set drink(value: FavoriteDrink) {
    this.drinkSignal.set(value);
  }
  /** "icon" for cards, "labelled" for the details page. */
  @Input() variant: 'icon' | 'labelled' = 'icon';

  readonly saved = computed(() => {
    const drink = this.drinkSignal();
    return !!drink && this.favorites.isFavorite(drink);
  });
  readonly busy = computed(() => {
    const drink = this.drinkSignal();
    return !!drink && this.favorites.isBusy(drink);
  });
  readonly label = computed(() => {
    const name = this.drinkSignal()?.name ?? 'this drink';
    return this.saved()
      ? `Remove ${name} from favorites`
      : `Save ${name} to favorites`;
  });

  toggle(): void {
    const drink = this.drinkSignal();
    if (drink) this.favorites.toggle(drink);
  }
}
