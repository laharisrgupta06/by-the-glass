import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProductDescriptionComponent } from '../../../products/components/product-description/product-description.component';
import { ProductImageComponent } from '../../../products/components/product-image/product-image.component';
import { ProductIngredientsComponent } from '../../../products/components/product-ingredients/product-ingredients.component';
import { ProductInstructionsComponent } from '../../../products/components/product-instructions/product-instructions.component';
import { ProductDetailConfig } from '../../../products/config/product.config';
import { Recipe } from '../../../products/models/recipe.model';

export type SurpriseState = 'loading' | 'error' | 'empty' | 'missing' | 'ready';

/** A random drink, shown with the same pieces as the recipe page. */
@Component({
  selector: 'app-surprise-panel',
  standalone: true,
  imports: [
    RouterLink,
    ProductDescriptionComponent,
    ProductImageComponent,
    ProductIngredientsComponent,
    ProductInstructionsComponent,
  ],
  templateUrl: './surprise-panel.component.html',
  styleUrl: './surprise-panel.component.scss',
})
export class SurprisePanelComponent {
  @Input() state: SurpriseState = 'loading';
  @Input() recipe: Recipe | null = null;
  /** "cocktail", "mocktail" or "drink", matching the type picked. */
  @Input() noun = 'drink';

  @Output() another = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
  @Output() retry = new EventEmitter<void>();

  @ViewChild('panel', { static: true }) panel!: ElementRef<HTMLElement>;

  readonly config = ProductDetailConfig;

  /** Move focus to the panel so keyboard and screen reader users land on the drink. */
  focus(scroll: boolean, smooth: boolean): void {
    const panel = this.panel.nativeElement;
    panel.focus({ preventScroll: true });
    if (scroll)
      panel.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'start',
      });
  }
}
