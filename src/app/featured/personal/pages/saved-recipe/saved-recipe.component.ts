import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { AuthDialogService } from 'src/app/core/auth/auth-dialog.service';
import { AuthService } from 'src/app/core/auth/auth.service';
import { SavedRecipesService } from 'src/app/core/saved-recipes/saved-recipes.service';
import { AiRecipeCardComponent } from '../../../products/components/ai-recipe-card/ai-recipe-card.component';

/** One saved AI-curated recipe (/personal/saved-recipes/:id), in full, with Remove. */
@Component({
  selector: 'app-saved-recipe',
  standalone: true,
  imports: [RouterLink, AiRecipeCardComponent],
  templateUrl: './saved-recipe.component.html',
  styleUrl: '../my-recipe/my-recipe.component.scss',
})
export class SavedRecipeComponent {
  readonly auth = inject(AuthService);
  readonly saved = inject(SavedRecipesService);
  private authDialog = inject(AuthDialogService);
  private router = inject(Router);

  readonly id = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map(p => p.get('id') ?? '')),
    { initialValue: '' }
  );
  readonly item = computed(() =>
    this.saved.recipes().find(r => r.id === this.id())
  );
  readonly disclaimer =
    'Created by AI (Gemini) from your ingredients, with approximate amounts. It isn’t one of our catalogue recipes.';

  signIn(): void {
    this.authDialog.open({ mode: 'sign-in' });
  }

  async remove(): Promise<void> {
    const item = this.item();
    if (!item) return;
    await this.saved.remove(item);
    this.router.navigate(['/personal']);
  }
}
