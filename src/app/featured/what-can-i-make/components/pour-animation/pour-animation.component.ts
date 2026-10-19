import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * A bottle tipping and pouring into a glass, drawn in SVG and moved with CSS only.
 * Decorative (hidden from screen readers). With reduced motion it's a still frame,
 * mid-pour. Self-contained: drop <app-pour-animation> anywhere, or remove it.
 */
@Component({
  selector: 'app-pour-animation',
  standalone: true,
  templateUrl: './pour-animation.component.html',
  styleUrl: './pour-animation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PourAnimationComponent {}
