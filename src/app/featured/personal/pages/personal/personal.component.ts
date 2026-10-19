import {
  Component,
  ElementRef,
  computed,
  inject,
  ViewChild,
  signal,
} from '@angular/core';

import { AuthDialogService } from 'src/app/core/auth/auth-dialog.service';
import {
  AuthService,
  MAX_DISPLAY_NAME_LENGTH,
} from 'src/app/core/auth/auth.service';
import { FavoritesService } from 'src/app/core/favorites/favorites.service';
import { MyRecipesService } from 'src/app/core/my-recipes/my-recipes.service';
import { NoticeService } from 'src/app/core/notice/notice.service';
import { SavedRecipesService } from 'src/app/core/saved-recipes/saved-recipes.service';
import { FavoritesSectionComponent } from '../../components/favorites-section/favorites-section.component';
import { MyRecipesSectionComponent } from '../../components/my-recipes-section/my-recipes-section.component';
import { SavedRecipesSectionComponent } from '../../components/saved-recipes-section/saved-recipes-section.component';

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * Your profile: who you're signed in as, and your collection, kept in three parts:
 * Saved drinks, Saved AI recipes, and My recipes. Open to everyone; the content is the
 * signed-in person's own.
 */
@Component({
  selector: 'app-personal',
  standalone: true,
  imports: [
    FavoritesSectionComponent,
    SavedRecipesSectionComponent,
    MyRecipesSectionComponent,
  ],
  templateUrl: './personal.component.html',
  styleUrl: './personal.component.scss',
})
export class PersonalComponent {
  readonly auth = inject(AuthService);
  private authDialog = inject(AuthDialogService);
  private notice = inject(NoticeService);
  private favorites = inject(FavoritesService);
  private savedRecipes = inject(SavedRecipesService);
  private myRecipes = inject(MyRecipesService);
  readonly signingOut = signal(false);
  /** The page's backdrop: a project photo, faded into the page. Swap it here. */
  readonly backdrop = 'assets/images/home-hero.jpg';

  readonly hasName = computed(() => !!this.auth.user()?.displayName?.trim());
  /** The account's own name; nothing is made up when it has none. */
  readonly name = computed(
    () => this.auth.user()?.displayName?.trim() || 'Your profile'
  );

  // Edit profile: the display name only.
  readonly maxNameLength = MAX_DISPLAY_NAME_LENGTH;
  readonly editing = signal(false);
  readonly draftName = signal('');
  readonly nameError = signal('');
  readonly savingName = signal(false);
  @ViewChild('nameInput') private nameInput?: ElementRef<HTMLInputElement>;
  @ViewChild('editButton')
  private editButton?: ElementRef<HTMLButtonElement>;

  readonly initials = computed(() => {
    const user = this.auth.user();
    const words = (user?.displayName ?? '').trim().split(/\s+/).filter(Boolean);
    if (words.length)
      return words
        .slice(0, 2)
        .map(w => w[0].toUpperCase())
        .join('');
    return (user?.email?.[0] ?? '·').toUpperCase();
  });

  /** Counts, once each part has loaded. */
  readonly stats = computed(() => {
    const stats: string[] = [];
    if (this.favorites.status() === 'ready')
      stats.push(
        plural(this.favorites.favorites().length, 'saved drink', 'saved drinks')
      );
    if (this.savedRecipes.status() === 'ready')
      stats.push(
        plural(this.savedRecipes.recipes().length, 'AI recipe', 'AI recipes')
      );
    if (this.myRecipes.status() === 'ready')
      stats.push(
        plural(
          this.myRecipes.recipes().length,
          'recipe of your own',
          'recipes of your own'
        )
      );
    return stats;
  });

  signIn(): void {
    this.authDialog.open({ mode: 'sign-in' });
  }

  createAccount(): void {
    this.authDialog.open({ mode: 'sign-up' });
  }

  startEditing(): void {
    this.draftName.set(this.auth.user()?.displayName?.trim() ?? '');
    this.nameError.set('');
    this.editing.set(true);
    setTimeout(() => this.nameInput?.nativeElement.focus());
  }

  stopEditing(): void {
    if (this.savingName()) return;
    this.editing.set(false);
    this.nameError.set('');
    setTimeout(() => this.editButton?.nativeElement.focus());
  }

  async saveName(event: Event): Promise<void> {
    event.preventDefault();
    if (this.savingName()) return;
    this.savingName.set(true);
    const error = await this.auth.updateDisplayName(this.draftName());
    this.savingName.set(false);
    if (error) {
      this.nameError.set(error);
      this.nameInput?.nativeElement.focus();
      return;
    }
    this.notice.show('Profile updated.');
    this.stopEditing();
  }

  async signOut(): Promise<void> {
    this.signingOut.set(true);
    const error = await this.auth.signOut();
    this.signingOut.set(false);
    if (error) this.notice.show(error);
  }
}
