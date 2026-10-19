import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { FavoritesService } from 'src/app/core/favorites/favorites.service';
import { FavoritesSectionComponent } from './favorites-section.component';

describe('FavoritesSectionComponent', () => {
  let fixture: ComponentFixture<FavoritesSectionComponent>;
  const reload = jasmine.createSpy('reload');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FavoritesSectionComponent],
      providers: [
        provideRouter([]),
        {
          provide: FavoritesService,
          useValue: { status: signal('error'), favorites: signal([]), reload },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FavoritesSectionComponent);
  });

  it('points development builds at the emulators when favorites fail', () => {
    fixture.componentInstance.usingEmulators = true;
    fixture.detectChanges();
    const alert: HTMLElement =
      fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert.textContent).toContain("We couldn't open your favorites.");
    expect(alert.textContent).toContain('npm run emulators');
  });

  it('keeps the connection message for real deployments, with a retry', () => {
    fixture.componentInstance.usingEmulators = false;
    fixture.detectChanges();
    const alert: HTMLElement =
      fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert.textContent).toContain('Check your connection');
    alert.querySelector('button')!.click();
    expect(reload).toHaveBeenCalled();
  });
});
