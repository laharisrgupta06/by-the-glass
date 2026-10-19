import { TestBed } from '@angular/core/testing';

import { PourAnimationComponent } from './pour-animation.component';

describe('PourAnimationComponent', () => {
  it('draws a bottle, a stream and a glass, hidden from screen readers', () => {
    const fixture = TestBed.createComponent(PourAnimationComponent);
    fixture.detectChanges();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    for (const part of ['.bottle', '.stream', '.glass', '.liquid'])
      expect(svg.querySelector(part)).withContext(part).not.toBeNull();
  });
});
