import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IngredientShelvesComponent } from './ingredient-shelves.component';

describe('IngredientShelvesComponent', () => {
  let component: IngredientShelvesComponent;
  let fixture: ComponentFixture<IngredientShelvesComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const shelfButton = (label: string) =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('.shelf')).find(b =>
      b.textContent!.includes(label)
    )!;
  const ingredientButtons = () =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('.ingredient'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IngredientShelvesComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(IngredientShelvesComponent);
    component = fixture.componentInstance;
    component.categories = [
      { id: 'spirits', label: 'Spirits', words: ['gin', 'vodka'] },
      { id: 'juices', label: 'Juices', words: ['juice'] },
      { id: 'fruit', label: 'Fruit', words: ['lime'] },
    ];
    component.options = [
      { key: 'gin', label: 'Gin', count: 3 },
      { key: 'vodka', label: 'Vodka', count: 2 },
      { key: 'lime juice', label: 'Lime juice', count: 4 },
    ];
    fixture.detectChanges();
  });

  it('only lists categories the data has', () => {
    const labels = Array.from(el().querySelectorAll('.shelf')).map(b =>
      b.textContent!.trim()
    );
    expect(labels).toEqual(['Spirits', 'Juices']);
  });

  it('opens one category at a time and shows its ingredients', () => {
    expect(el().querySelector('.panel')).toBeNull();
    shelfButton('Spirits').click();
    fixture.detectChanges();
    expect(shelfButton('Spirits').getAttribute('aria-expanded')).toBe('true');
    expect(ingredientButtons().map(b => b.textContent!.trim())).toEqual([
      '+ Gin',
      '+ Vodka',
    ]);

    shelfButton('Juices').click();
    fixture.detectChanges();
    expect(shelfButton('Spirits').getAttribute('aria-expanded')).toBe('false');
    expect(ingredientButtons().map(b => b.textContent!.trim())).toEqual([
      '+ Lime juice',
    ]);

    shelfButton('Juices').click();
    fixture.detectChanges();
    expect(el().querySelector('.panel')).toBeNull();
  });

  it('adds an ingredient, and removes it when it is already added', () => {
    const added: string[] = [];
    const removed: string[] = [];
    component.add.subscribe(k => added.push(k));
    component.remove.subscribe(k => removed.push(k));
    component.selected = ['vodka'];
    shelfButton('Spirits').click();
    fixture.detectChanges();

    const [gin, vodka] = ingredientButtons();
    expect(gin.getAttribute('aria-pressed')).toBe('false');
    expect(vodka.getAttribute('aria-pressed')).toBe('true');
    expect(shelfButton('Spirits').textContent).toContain('1 added');
    gin.click();
    vodka.click();
    expect(added).toEqual(['gin']);
    expect(removed).toEqual(['vodka']);
  });
});
