import { Component, Input } from '@angular/core';

import { RecipeTranslation } from '../../models/recipe.model';
import { toSteps } from '../../utils/recipe-text';

@Component({
  selector: 'app-product-instructions',
  standalone: true,
  templateUrl: './product-instructions.component.html',
  styleUrl: './product-instructions.component.scss',
})
export class ProductInstructionsComponent {
  @Input() title = 'Method';
  @Input() translationsLabel = 'Method in other languages';
  @Input() translations: RecipeTranslation[] = [];
  @Input() set instructions(value: string | undefined) {
    this.fromText = toSteps(value);
  }
  /** Steps the source already gives one by one; these win over splitting the text. */
  @Input() set stepList(value: string[] | undefined) {
    this.listed = value ?? [];
  }

  private fromText: string[] = [];
  private listed: string[] = [];

  get steps(): string[] {
    return this.listed.length ? this.listed : this.fromText;
  }
}
