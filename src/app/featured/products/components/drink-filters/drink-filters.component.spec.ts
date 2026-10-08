import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DrinkFiltersComponent } from './drink-filters.component';

describe('DrinkFiltersComponent', () => {
  let component: DrinkFiltersComponent;
  let fixture: ComponentFixture<DrinkFiltersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DrinkFiltersComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DrinkFiltersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit the chosen spirit id', () => {
    component.spirits = [{ id: 'gin', label: 'Gin', terms: ['gin'] }];
    fixture.detectChanges();
    const emitted: string[] = [];
    component.spiritChange.subscribe(id => emitted.push(id));
    const select: HTMLSelectElement =
      fixture.nativeElement.querySelector('select');
    select.value = 'gin';
    select.dispatchEvent(new Event('change'));
    expect(emitted).toEqual(['gin']);
  });
});
