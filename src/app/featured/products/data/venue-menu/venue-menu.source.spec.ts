import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { useVenueMenu } from '../../testing/venue-menu.testing';
import {
  VENUE_MENU_DRINKS,
  VENUE_MENU_TRANSCRIBED_ON,
  VenueMenuDrink,
} from './venue-menu.data';
import {
  VENUE_MENU_ENABLED,
  VenueMenuSource,
  fromVenueMenu,
} from './venue-menu.source';

// Fictional menu drinks, not from any menu.
const TEST_MENU: VenueMenuDrink[] = [
  {
    id: 'bg-menu-test-lantern-sour',
    name: 'Test Lantern Sour',
    section: 'Test Cocktails',
    kind: 'cocktail',
    ingredients: [
      'gin',
      'quince',
      'meadowsweet extract',
      'orange juice',
      'lime',
    ],
    flavourNotes: ['sweet', 'floral'],
  },
  {
    id: 'bg-menu-test-kestrel-kick',
    name: 'Kestrel Kick',
    section: 'Test Cocktails',
    kind: 'cocktail',
    ingredients: ['tequila', 'rhubarb cordial'],
    flavourNotes: ['sour'],
  },
  {
    id: 'bg-menu-test-kelp-fizz',
    name: 'Kelp Fizz',
    section: 'Test Zero Proof',
    kind: 'zero_proof',
    ingredients: ['Fernhollow zero rum', 'kelp cordial'],
    flavourNotes: ['salty'],
  },
  {
    id: 'bg-menu-test-kelp-fizz-2-0',
    name: 'Kelp Fizz 2.0',
    section: 'Test Mocktails',
    kind: 'mocktail',
    ingredients: ['kelp cordial', 'soda'],
    flavourNotes: ['salty'],
  },
  {
    id: 'bg-menu-test-saffron-lassi',
    name: 'Test Saffron Lassi',
    section: 'Test Mocktails',
    kind: 'mocktail',
    ingredients: ['saffron syrup', 'yoghurt'],
    flavourNotes: ['sweet'],
  },
];
const byName = (name: string) => TEST_MENU.find(d => d.name === name)!;

describe('venue menu source', () => {
  describe('fromVenueMenu', () => {
    it('keeps only what the menu says, flagged as a menu description', () => {
      const recipe = fromVenueMenu(byName('Test Lantern Sour'));
      expect(recipe).toEqual({
        id: 'bg-menu-test-lantern-sour',
        source: 'venue-menu',
        // Dated when the menu data has a transcription date (an empty placeholder has none).
        credit: VENUE_MENU_TRANSCRIBED_ON
          ? `a user-supplied venue menu transcription (${VENUE_MENU_TRANSCRIBED_ON})`
          : 'a user-supplied venue menu transcription',
        name: 'Test Lantern Sour',
        kind: 'cocktail',
        style: undefined,
        category: 'Test Cocktails',
        ingredients: [
          { name: 'gin' },
          { name: 'quince' },
          { name: 'meadowsweet extract' },
          { name: 'orange juice' },
          { name: 'lime' },
        ],
        flavours: ['sweet', 'floral'],
        // Built only from the menu's own flavour notes and ingredients.
        description:
          'A sweet, floral cocktail of gin, quince, meadowsweet extract, orange juice and lime.',
        translations: [],
        hasDetails: true,
        completeness: 'menu-description',
      });
    });

    it('never invents measures, method, glass, garnish, servings or a photo', () => {
      // The fictional drinks, and the real menu too where it's present.
      for (const drink of [...TEST_MENU, ...VENUE_MENU_DRINKS]) {
        const recipe = fromVenueMenu(drink);
        expect(
          recipe.ingredients.every(i => i.measure === undefined)
        ).toBeTrue();
        for (const field of [
          'instructions',
          'glass',
          'garnish',
          'servings',
          'image',
          'thumbnail',
          'iba',
        ] as const)
          expect(recipe[field])
            .withContext(`${drink.name}.${field}`)
            .toBeUndefined();
      }
    });

    it('keeps zero-proof drinks non-alcoholic, but labelled as zero-proof', () => {
      const zero = fromVenueMenu(byName('Kelp Fizz'));
      expect(zero.kind).toBe('mocktail');
      expect(zero.style).toBe('zero-proof');
      expect(fromVenueMenu(byName('Test Saffron Lassi')).style).toBeUndefined();
      expect(fromVenueMenu(byName('Kestrel Kick')).kind).toBe('cocktail');
    });

    it('keeps the id when a drink is renamed', () => {
      const renamed = fromVenueMenu({
        ...byName('Kestrel Kick'),
        name: 'Kestrel Kicker',
      });
      expect(renamed.id).toBe('bg-menu-test-kestrel-kick');
      expect(renamed.name).toBe('Kestrel Kicker');
    });
  });

  describe('lookups', () => {
    // The source reads the menu data when it's created, so swap the fictional one in.
    useVenueMenu(TEST_MENU);

    function source(enabled: boolean) {
      TestBed.configureTestingModule({
        providers: [{ provide: VENUE_MENU_ENABLED, useValue: enabled }],
      });
      return TestBed.inject(VenueMenuSource);
    }

    it('finds drinks by id, letter and name', async () => {
      const menu = source(true);
      expect(
        (await firstValueFrom(menu.byId('bg-menu-test-saffron-lassi')))?.name
      ).toBe('Test Saffron Lassi');
      expect(await firstValueFrom(menu.byId('11007'))).toBeUndefined();
      expect(
        (await firstValueFrom(menu.byLetter('K'))).map(r => r.name)
      ).toEqual(
        jasmine.arrayWithExactContents([
          'Kestrel Kick',
          'Kelp Fizz',
          'Kelp Fizz 2.0',
        ])
      );
      expect((await firstValueFrom(menu.searchByName('kelp'))).length).toBe(2);
      expect((await firstValueFrom(menu.browse())).length).toBe(5);
      expect((await firstValueFrom(menu.detailed())).length).toBe(5);
    });

    it('has nothing at all when switched off', async () => {
      const menu = source(false);
      expect(await firstValueFrom(menu.browse())).toEqual([]);
      expect(await firstValueFrom(menu.detailed())).toEqual([]);
      expect(await firstValueFrom(menu.searchByName('kelp'))).toEqual([]);
      expect(
        await firstValueFrom(menu.byId('bg-menu-test-saffron-lassi'))
      ).toBeUndefined();
    });
  });
});
