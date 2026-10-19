import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';

import { IngredientInterpreterService } from '../../data/ingredient-interpreter.service';

import { IngredientPickerComponent } from './ingredient-picker.component';

describe('IngredientPickerComponent', () => {
  let component: IngredientPickerComponent;
  let fixture: ComponentFixture<IngredientPickerComponent>;
  let input: HTMLInputElement;
  let added: string[];
  const available = signal(false);

  const type = (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const key = (name: string) => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: name }));
    fixture.detectChanges();
  };
  const options = () =>
    [...fixture.nativeElement.querySelectorAll('[role="option"]')].map(
      (o: HTMLElement) => o.querySelector('.option-name')!.textContent
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IngredientPickerComponent, NoopAnimationsModule],
      providers: [
        {
          provide: IngredientInterpreterService,
          useValue: {
            available,
            checkAvailability: () => undefined,
            interpret: () => undefined,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IngredientPickerComponent);
    component = fixture.componentInstance;
    component.options = [
      { key: 'lime juice', label: 'Lime juice', count: 40 },
      { key: 'lime', label: 'Lime', count: 30 },
      { key: 'gin', label: 'Gin', count: 80 },
    ];
    component.status = 'ready';
    added = [];
    component.add.subscribe(k => added.push(k));
    fixture.detectChanges();
    input = fixture.nativeElement.querySelector('input');
  });

  it('suggests matching ingredients as a listbox', () => {
    type('LIM');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(options()).toEqual(['Lime juice', 'Lime']);
  });

  it('adds the highlighted suggestion with Enter, after arrowing to it', () => {
    type('lim');
    key('ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe(
      'cabinet-option-1'
    );
    key('Enter');
    expect(added).toEqual(['lime']);
    expect(input.value).toBe('');
  });

  it('closes the list with Escape', () => {
    type('gin');
    key('Escape');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not offer what is already picked, and says so', () => {
    component.selected = ['gin'];
    type('gin');
    expect(options()).toEqual([]);
    expect(fixture.nativeElement.querySelector('.hint').textContent).toContain(
      'Gin is already in'
    );
  });

  it('says plainly when no drink uses an ingredient', () => {
    type('lychee');
    expect(fixture.nativeElement.querySelector('.hint').textContent).toContain(
      'None of our drinks use “lychee” yet'
    );
  });

  it('shows picked ingredients as chips with named remove buttons', () => {
    component.selected = ['lime juice', 'gin'];
    fixture.detectChanges();
    const removed: string[] = [];
    component.remove.subscribe(k => removed.push(k));
    const buttons: HTMLButtonElement[] = [
      ...fixture.nativeElement.querySelectorAll('.chips button'),
    ];
    expect(buttons.map(b => b.getAttribute('aria-label'))).toEqual([
      'Remove Lime juice',
      'Remove Gin',
    ]);
    buttons[0].click();
    expect(removed).toEqual(['lime juice']);
  });

  it('offers to ask the bartender only when nothing matches and the feature is on', () => {
    available.set(false);
    type('lychee');
    expect(
      fixture.nativeElement.querySelector('app-ingredient-assist')
    ).toBeNull();

    available.set(true);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('app-ingredient-assist')
    ).not.toBeNull();

    // Database matches come first: no assist while there are suggestions.
    type('lim');
    expect(
      fixture.nativeElement.querySelector('app-ingredient-assist')
    ).toBeNull();
    available.set(false);
  });

  describe('your own ingredients', () => {
    let own: string[];
    beforeEach(() => {
      own = [];
      component.addOwn.subscribe(text => own.push(text));
    });
    const ownButton = () =>
      fixture.nativeElement.querySelector(
        'button.own'
      ) as HTMLButtonElement | null;

    it('offers to add something none of our drinks use, exactly as typed', () => {
      type('Mogu Mogu');
      expect(ownButton()!.textContent).toContain(
        'Add “Mogu Mogu” as your own ingredient'
      );
      ownButton()!.click();
      expect(own).toEqual(['Mogu Mogu']);
      expect(added).toEqual([]);
    });

    it('adds it with Enter too, and never as a similar ingredient', () => {
      type('Mogu Mogu');
      key('Enter');
      expect(own).toEqual(['Mogu Mogu']);
      expect(added).toEqual([]);
    });

    it('prefers our own ingredient when one matches', () => {
      type('lim');
      expect(ownButton()).toBeNull();
    });

    it('shows its chip as typed', () => {
      component.selected = ['mogu mogu'];
      component.customLabels = new Map([['mogu mogu', 'Mogu Mogu']]);
      fixture.detectChanges();
      const chip = fixture.nativeElement.querySelector('.chips li');
      expect(chip.textContent).toContain('Mogu Mogu');
      expect(chip.classList).toContain('own-chip');
    });
  });
});
