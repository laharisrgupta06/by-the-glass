import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { BARTENDER_PATHS } from 'src/app/core/ai/ai-recipe';
import { INTERPRET_PATHS } from 'src/app/core/ai/ingredient-interpretation';
import { SavedRecipesService } from 'src/app/core/saved-recipes/saved-recipes.service';
import { BartenderPanelComponent } from './bartender-panel.component';

const RECIPE = {
  name: 'Jelly Lime Cooler',
  kind: 'mocktail',
  description:
    'Mogu Mogu lengthened with lime and soda; the coconut jelly stays.',
  ingredients: [
    { name: 'Mogu Mogu', amount: '1 bottle (320 ml)', optional: false },
    { name: 'Soda water', amount: 'Top up', optional: false },
    { name: 'Mint', amount: '1 sprig', optional: true },
  ],
  steps: [
    'Fill a highball with ice.',
    'Pour in the Mogu Mogu.',
    'Top with soda.',
  ],
  glass: 'Highball',
  ice: 'Over cubed ice',
  garnish: 'Mint sprig',
  serving: 'Serve with a wide straw for the jelly.',
};

describe('BartenderPanelComponent', () => {
  let fixture: ComponentFixture<BartenderPanelComponent>;
  let http: HttpTestingController;
  let saved: jasmine.SpyObj<SavedRecipesService>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');
  const askButton = () => el().querySelector<HTMLButtonElement>('button.ai')!;

  function setUp(available = true, ingredients = ['Mogu Mogu']) {
    saved = jasmine.createSpyObj('SavedRecipesService', [
      'save',
      'isSaved',
      'isBusy',
    ]);
    saved.isSaved.and.returnValue(false);
    saved.isBusy.and.returnValue(false);
    TestBed.configureTestingModule({
      imports: [BartenderPanelComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SavedRecipesService, useValue: saved },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BartenderPanelComponent);
    fixture.componentInstance.ingredients = ingredients;
    fixture.componentInstance.type = 'mocktail';
    fixture.componentInstance.tastes = ['Sour'];
    fixture.detectChanges();
    http.expectOne(INTERPRET_PATHS.status).flush({ available });
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('offers "Ask AI Bartender to Create a Drink"', () => {
    setUp();
    expect(askButton().textContent).toContain(
      'Ask AI Bartender to Create a Drink'
    );
    expect(askButton().disabled).toBeFalse();
  });

  it('says plainly when the AI Bartender is unavailable', () => {
    setUp(false);
    expect(askButton().disabled).toBeTrue();
    expect(text()).toContain("The AI Bartender isn't available right now.");
  });

  it('asks for an ingredient first', () => {
    setUp(true, []);
    askButton().click();
    fixture.detectChanges();
    expect(text()).toContain('Add at least one ingredient first');
    http.expectNone(BARTENDER_PATHS.create);
  });

  it('creates a drink with Mogu Mogu itself, with no catalogue match needed', () => {
    setUp();
    askButton().click();
    fixture.detectChanges();
    // Loading, and a second click sends nothing more.
    expect(askButton().disabled).toBeTrue();
    expect(askButton().textContent).toContain('Creating your drink…');
    askButton().click();
    const req = http.expectOne(BARTENDER_PATHS.create);
    expect(req.request.body).toEqual({
      ingredients: ['Mogu Mogu'],
      type: 'mocktail',
      tastes: ['Sour'],
    });
    req.flush({ recipe: RECIPE, basedOn: ['Mogu Mogu'] });
    fixture.detectChanges();

    expect(text()).toContain('AI-created drink');
    expect(text()).toContain('AI-curated');
    expect(text()).toContain("You'd also need Soda water.");
    const rows = Array.from(el().querySelectorAll('.ingredients li')).map(li =>
      Array.from(li.children)
        .map(c => c.textContent!.trim())
        .join(' | ')
    );
    expect(rows).toEqual([
      '1 bottle (320 ml) | Mogu Mogu | You have',
      "Top up | Soda water | You'd need",
      "1 sprig | Mint | You'd need · optional",
    ]);
    expect(text()).toContain('Fill a highball with ice.');
    expect(text()).toContain('Serve with a wide straw for the jelly.');
  });

  it('never shows an answer that fails the checks', () => {
    setUp();
    askButton().click();
    http.expectOne(BARTENDER_PATHS.create).flush({
      recipe: {
        ...RECIPE,
        ingredients: [
          ...RECIPE.ingredients,
          { name: 'Vodka', amount: '30 ml', optional: true },
        ],
      },
      basedOn: ['Mogu Mogu'],
    });
    fixture.detectChanges();
    expect(text()).toContain("didn't pass our checks");
    expect(text()).toContain('No drink was created.');
    expect(el().querySelector('app-ai-recipe-card')).toBeNull();
  });

  it('reports Gemini being busy, and can try again', () => {
    setUp();
    askButton().click();
    http
      .expectOne(BARTENDER_PATHS.create)
      .flush(
        { error: 'busy' },
        { status: 503, statusText: 'Busy', headers: { 'Retry-After': '30' } }
      );
    fixture.detectChanges();
    expect(text()).toContain(
      'Gemini is very busy right now. Try again in about 30 seconds.'
    );
    el().querySelector<HTMLButtonElement>('.status .text-button')!.click();
    http
      .expectOne(BARTENDER_PATHS.create)
      .flush({ recipe: RECIPE, basedOn: ['Mogu Mogu'] });
    fixture.detectChanges();
    expect(el().querySelector('app-ai-recipe-card')).not.toBeNull();
  });

  it('says plainly when the Gemini quota is used up, with a wait in hours', () => {
    setUp();
    askButton().click();
    http.expectOne(BARTENDER_PATHS.create).flush(
      { error: 'quota' },
      {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Retry-After': '68000' },
      }
    );
    fixture.detectChanges();
    expect(text()).toContain(
      'The Gemini usage limit for this key has been reached. Try again in about 19 hours.'
    );
    expect(text()).not.toContain('busy');
    expect(el().querySelector('app-ai-recipe-card')).toBeNull();
  });

  it('saves the complete recipe with what it was based on', () => {
    setUp();
    askButton().click();
    http
      .expectOne(BARTENDER_PATHS.create)
      .flush({ recipe: RECIPE, basedOn: ['Mogu Mogu'] });
    fixture.detectChanges();
    el().querySelector<HTMLButtonElement>('button.save')!.click();
    const [recipe, basedOn] = saved.save.calls.mostRecent().args;
    expect(recipe.name).toBe('Jelly Lime Cooler');
    expect(recipe.steps.length).toBe(3);
    expect(recipe.ingredients[0]).toEqual(
      jasmine.objectContaining({ name: 'Mogu Mogu', origin: 'given' })
    );
    expect(basedOn).toEqual(['Mogu Mogu']);
  });
});
