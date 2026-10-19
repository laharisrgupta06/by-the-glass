import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { MenuIllustration, StoredMenuRecipe } from 'src/app/core/ai/ai-recipe';
import { MenuCurationComponent } from '../../components/menu-curation/menu-curation.component';
import { ProductDescriptionComponent } from '../../components/product-description/product-description.component';
import { ProductImageComponent } from '../../components/product-image/product-image.component';
import { ProductIngredientsComponent } from '../../components/product-ingredients/product-ingredients.component';
import { ProductInstructionsComponent } from '../../components/product-instructions/product-instructions.component';
import { PRODUCT_DETIAL_CONFIG_DATA } from '../../config/product.config';
import { withApproximateRecipe } from '../../data/venue-menu/approximate-recipe';
import { isMenuDescription } from '../../models/recipe.model';
import { ProductsStore } from '../../store/product.store';

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [
    RouterLink,
    ProductDescriptionComponent,
    ProductImageComponent,
    ProductIngredientsComponent,
    ProductInstructionsComponent,
    MenuCurationComponent,
  ],
  templateUrl: './product-details.component.html',
  styleUrl: './product-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailsComponent implements OnInit {
  readonly productsStore = inject(ProductsStore);
  readonly productDetailConfig = inject(PRODUCT_DETIAL_CONFIG_DATA);
  readonly isMenuDescription = isMenuDescription;
  /** A venue drink's illustration, once one has been supplied. */
  readonly illustration = signal<MenuIllustration | null>(null);
  /** A venue drink's stored approximate recipe, when it has one. */
  readonly menuRecipe = signal<StoredMenuRecipe | null>(null);

  /**
   * What the page shows: the recipe as loaded, or a venue drink with its stored
   * approximate recipe folded into the usual layout (only for the same drink).
   */
  readonly shown = computed(() => {
    const recipe = this.productsStore.recipe();
    return recipe ? withApproximateRecipe(recipe, this.menuRecipe()) : null;
  });
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);

  ngOnInit(): void {
    this.productsStore.loadRecipe(
      this.route.paramMap.pipe(map(params => params.get('id') ?? ''))
    );
  }

  /** Go back to the filtered Drinks list when we came from it; otherwise to /drinks. */
  back(event: Event): void {
    const previous =
      this.router.lastSuccessfulNavigation?.previousNavigation?.finalUrl;
    if (previous && this.router.serializeUrl(previous).startsWith('/drinks')) {
      event.preventDefault();
      this.location.back();
    }
  }

  retry(): void {
    this.productsStore.loadRecipe(this.route.snapshot.paramMap.get('id') ?? '');
  }
}
