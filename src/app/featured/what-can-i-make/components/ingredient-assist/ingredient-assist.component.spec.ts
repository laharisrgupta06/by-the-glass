import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { IngredientInterpretation } from 'src/app/core/ai/ingredient-interpretation';
import {
  IngredientInterpreterService,
  InterpretFailure,
} from '../../data/ingredient-interpreter.service';
import { IngredientAssistComponent } from './ingredient-assist.component';

describe('IngredientAssistComponent', () => {
  let fixture: ComponentFixture<IngredientAssistComponent>;
  let component: IngredientAssistComponent;
  let interpreter: jasmine.SpyObj<IngredientInterpreterService>;
  const el = () => fixture.nativeElement as HTMLElement;
  const options = [
    { key: 'coconut milk', label: 'Coconut milk', count: 1 },
    { key: 'sugar syrup', label: 'Sugar syrup', count: 9 },
  ];
  const answer: IngredientInterpretation = {
    term: 'Mogu Mogu',
    summary: 'A juice drink with nata de coco.',
    suggestions: [
      {
        ingredient: 'Coconut milk',
        relation: 'similar',
        reason: 'Both from coconut.',
      },
      {
        ingredient: 'Sugar syrup',
        relation: 'made-from',
        reason: 'Sweetened.',
      },
    ],
  };

  beforeEach(async () => {
    interpreter = jasmine.createSpyObj('IngredientInterpreterService', [
      'interpret',
    ]);
    await TestBed.configureTestingModule({
      imports: [IngredientAssistComponent],
      providers: [
        { provide: IngredientInterpreterService, useValue: interpreter },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(IngredientAssistComponent);
    component = fixture.componentInstance;
    component.term = 'Mogu Mogu';
    component.options = options;
    component.selected = ['sugar syrup'];
    fixture.detectChanges();
  });

  it('asks only when the button is pressed, sending our ingredient names', () => {
    expect(interpreter.interpret).not.toHaveBeenCalled();
    const ask = el().querySelector<HTMLButtonElement>('.ask')!;
    expect(ask.textContent).toContain('Ask our bartender about “Mogu Mogu”');
    interpreter.interpret.and.returnValue(
      new Subject<IngredientInterpretation>()
    );
    ask.click();
    fixture.detectChanges();
    expect(interpreter.interpret).toHaveBeenCalledWith('Mogu Mogu', [
      'Coconut milk',
      'Sugar syrup',
    ]);
    expect(el().querySelector('[role="status"]')!.textContent).toContain(
      'Asking the bartender'
    );
  });

  it('shows the answer, and adds a suggestion only when confirmed', () => {
    interpreter.interpret.and.returnValue(of(answer));
    const added: string[] = [];
    component.add.subscribe(o => added.push(o.key));
    el().querySelector<HTMLButtonElement>('.ask')!.click();
    fixture.detectChanges();
    expect(el().textContent).toContain('A juice drink with nata de coco.');
    expect(el().textContent).toContain('Suggested by Gemini');
    expect(added).toEqual([]);
    const addButtons = Array.from(
      el().querySelectorAll<HTMLButtonElement>('.add')
    );
    expect(addButtons.map(b => b.textContent!.trim())).toEqual([
      '+ Add Coconut milk',
    ]);
    expect(el().querySelector('.added')!.textContent).toContain('Already in');
    addButtons[0].click();
    expect(added).toEqual(['coconut milk']);
  });

  it('says plainly when nothing in our drinks relates', () => {
    interpreter.interpret.and.returnValue(of({ ...answer, suggestions: [] }));
    el().querySelector<HTMLButtonElement>('.ask')!.click();
    fixture.detectChanges();
    expect(el().textContent).toContain('nothing to add');
    expect(el().querySelector('.add')).toBeNull();
  });

  it('explains each failure accurately, offering a retry only where it can help', () => {
    const cases: [InterpretFailure, string, boolean][] = [
      [
        { code: 'busy', retryAfter: 55 },
        'Gemini is very busy right now. Try again in about 55 seconds.',
        true,
      ],
      [
        { code: 'quota', retryAfter: 120 },
        "We've hit the question limit for now. Try again in about 2 minutes.",
        true,
      ],
      [
        { code: 'rate-limited', retryAfter: 30 },
        'Too many questions at once. Try again in about 30 seconds.',
        true,
      ],
      [{ code: 'timeout' }, 'The bartender took too long to answer.', true],
      [
        { code: 'misconfigured' },
        "The bartender isn't set up correctly.",
        false,
      ],
      [{ code: 'offline' }, "Can't reach the bartender service.", true],
      [{ code: 'unavailable' }, "The bartender isn't in right now.", false],
      [{ code: 'failed' }, "The bartender couldn't answer just now.", true],
    ];
    for (const [failure, message, retry] of cases) {
      interpreter.interpret.and.returnValue(throwError(() => failure));
      component.ask();
      fixture.detectChanges();
      const alert = el().querySelector('[role="alert"]')!;
      expect(alert.textContent!.replace(/\s+/g, ' ')).toContain(message);
      expect(!!el().querySelector('.text-button'))
        .withContext(failure.code)
        .toBe(retry);
    }
  });

  it('tells developers how to start the API when it is unreachable', () => {
    interpreter.interpret.and.returnValue(
      throwError(() => ({ code: 'offline' }))
    );
    component.ask();
    fixture.detectChanges();
    // Unit tests run in dev mode.
    expect(el().querySelector('[role="alert"] code')!.textContent).toBe(
      'npm run api:dev'
    );
  });

  it('says it is still thinking when an answer is slow', fakeAsync(() => {
    const pending = new Subject<IngredientInterpretation>();
    interpreter.interpret.and.returnValue(pending);
    component.ask();
    fixture.detectChanges();
    expect(el().textContent).not.toContain('Still thinking');
    tick(8_000);
    fixture.detectChanges();
    expect(el().textContent).toContain('Still thinking');
    pending.next(answer);
    fixture.detectChanges();
    expect(el().textContent).not.toContain('Still thinking');
  }));

  it('starts over when the term changes', () => {
    interpreter.interpret.and.returnValue(of(answer));
    el().querySelector<HTMLButtonElement>('.ask')!.click();
    component.term = 'Calpis';
    fixture.detectChanges();
    expect(el().querySelector('.ask')!.textContent).toContain('Calpis');
    expect(el().querySelector('.answer')).toBeNull();
  });
});
