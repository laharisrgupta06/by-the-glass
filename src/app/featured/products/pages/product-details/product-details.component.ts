import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { ProductDescriptionComponent } from '../../components/product-description/product-description.component';
import { ProductImageComponent } from '../../components/product-image/product-image.component';
import { ProductIngredientsComponent } from '../../components/product-ingredients/product-ingredients.component';
import { ProductInstructionsComponent } from '../../components/product-instructions/product-instructions.component';
import { PRODUCT_DETIAL_CONFIG_DATA } from '../../config/product.config';
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
  ],
  templateUrl: './product-details.component.html',
  styleUrl: './product-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailsComponent implements OnInit {
  readonly productsStore = inject(ProductsStore);
  readonly productDetailConfig = inject(PRODUCT_DETIAL_CONFIG_DATA);
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
