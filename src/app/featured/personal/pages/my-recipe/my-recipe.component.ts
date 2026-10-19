import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { AuthDialogService } from 'src/app/core/auth/auth-dialog.service';
import { AuthService } from 'src/app/core/auth/auth.service';
import { toDisplayRecipe } from 'src/app/core/my-recipes/my-recipe.model';
import { MyRecipesService } from 'src/app/core/my-recipes/my-recipes.service';
import { ProductDescriptionComponent } from '../../../products/components/product-description/product-description.component';
import { ProductImageComponent } from '../../../products/components/product-image/product-image.component';
import { ProductIngredientsComponent } from '../../../products/components/product-ingredients/product-ingredients.component';
import { ProductInstructionsComponent } from '../../../products/components/product-instructions/product-instructions.component';

/** One of your own recipes (/personal/recipes/:id), with edit and delete. */
@Component({
  selector: 'app-my-recipe',
  standalone: true,
  imports: [
    RouterLink,
    ProductDescriptionComponent,
    ProductImageComponent,
    ProductIngredientsComponent,
    ProductInstructionsComponent,
  ],
  templateUrl: './my-recipe.component.html',
  styleUrl: './my-recipe.component.scss',
})
export class MyRecipeComponent {
  readonly auth = inject(AuthService);
  readonly recipes = inject(MyRecipesService);
  private authDialog = inject(AuthDialogService);
  private router = inject(Router);

  readonly id = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map(p => p.get('id') ?? '')),
    { initialValue: '' }
  );
  readonly recipe = computed(() => this.recipes.byId(this.id()));
  readonly shown = computed(() => {
    const recipe = this.recipe();
    return recipe ? toDisplayRecipe(recipe) : null;
  });
  /** Delete asks once more before anything is removed. */
  readonly confirming = signal(false);

  signIn(): void {
    this.authDialog.open({ mode: 'sign-in' });
  }

  async remove(): Promise<void> {
    if (await this.recipes.remove(this.id()))
      this.router.navigate(['/personal']);
    else this.confirming.set(false);
  }
}
