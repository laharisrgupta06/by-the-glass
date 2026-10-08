import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-product-image',
  standalone: true,
  templateUrl: './product-image.component.html',
  styleUrl: './product-image.component.scss',
})
export class ProductImageComponent {
  @Input() src?: string;
  @Input() alt = '';
}
