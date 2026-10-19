import {
  INTERPRET_LIMITS,
  cleanTerm,
  cleanText,
  cleanVocabulary,
  sanitizeInterpretation,
  truncate,
} from './ingredient-interpretation';

const VOCABULARY = [
  'Lime',
  'Lime juice',
  'Soda water',
  'Club soda',
  'Sugar syrup',
  'Coconut milk',
];

describe('ingredient interpretation contract', () => {
  describe('input checks', () => {
    it('accepts a sensible term, tidied', () => {
      expect(cleanTerm('  Mogu   Mogu ')).toBe('Mogu Mogu');
      expect(cleanTerm('7-Up')).toBe('7-Up');
    });

    it('rejects empty, punctuation-only, overlong or non-string terms', () => {
      expect(cleanTerm('')).toBeNull();
      expect(cleanTerm('  !!! ')).toBeNull();
      expect(cleanTerm('x'.repeat(INTERPRET_LIMITS.termLength + 1))).toBeNull();
      expect(cleanTerm(42)).toBeNull();
      expect(cleanTerm({ term: 'gin' })).toBeNull();
    });

    it('strips control and invisible characters', () => {
      expect(cleanText('nata\u0000 de​ coco ')).toBe('nata de coco');
    });

    it('de-duplicates the vocabulary and rejects bad lists', () => {
      expect(cleanVocabulary(['Lime', 'lime', ' Gin '])).toEqual([
        'Lime',
        'Gin',
      ]);
      expect(cleanVocabulary([])).toBeNull();
      expect(cleanVocabulary('Lime')).toBeNull();
      expect(cleanVocabulary(['Lime', 7])).toBeNull();
      expect(
        cleanVocabulary(['x'.repeat(INTERPRET_LIMITS.labelLength + 1)])
      ).toBeNull();
      expect(
        cleanVocabulary(
          Array.from(
            { length: INTERPRET_LIMITS.vocabularySize + 1 },
            (_, i) => `I${i}`
          )
        )
      ).toBeNull();
    });

    it('truncates on a word boundary', () => {
      expect(truncate('A long sentence about coconut jelly', 20)).toBe(
        'A long sentence…'
      );
      expect(truncate('short', 20)).toBe('short');
    });
  });

  describe('answer checks', () => {
    it('keeps suggestions that name a known ingredient, in its exact spelling', () => {
      const result = sanitizeInterpretation(
        {
          summary: 'Fizzy water.',
          suggestions: [
            {
              ingredient: 'club SODA',
              relation: 'same',
              reason: 'Another name.',
            },
          ],
        },
        'Sparkling water',
        VOCABULARY
      );
      expect(result.suggestions).toEqual([
        { ingredient: 'Club soda', relation: 'same', reason: 'Another name.' },
      ]);
    });

    it('drops invented ingredients and unknown relations instead of repairing them', () => {
      const result = sanitizeInterpretation(
        {
          summary: 'A coconut drink.',
          suggestions: [
            {
              ingredient: 'Nata de coco',
              relation: 'same',
              reason: 'Made up.',
            },
            {
              ingredient: 'Coconut milk',
              relation: 'cousin',
              reason: 'Bad relation.',
            },
            {
              ingredient: 'Coconut milk',
              relation: 'similar',
              reason: 'Close.',
            },
          ],
        },
        'Mogu Mogu',
        VOCABULARY
      );
      expect(result.suggestions.map(s => s.ingredient)).toEqual([
        'Coconut milk',
      ]);
    });

    it('drops duplicates, the term itself, and anything past the limit', () => {
      const result = sanitizeInterpretation(
        {
          summary: 'x',
          suggestions: [
            { ingredient: 'Lime', relation: 'same', reason: '' },
            { ingredient: 'Lime juice', relation: 'made-from', reason: '' },
            { ingredient: 'Lime juice', relation: 'same', reason: '' },
            { ingredient: 'Soda water', relation: 'similar', reason: '' },
            { ingredient: 'Club soda', relation: 'similar', reason: '' },
            { ingredient: 'Sugar syrup', relation: 'similar', reason: '' },
          ],
        },
        'lime',
        VOCABULARY
      );
      expect(result.suggestions.map(s => s.ingredient)).toEqual([
        'Lime juice',
        'Soda water',
        'Club soda',
      ]);
    });

    it('survives garbage without throwing', () => {
      for (const raw of [
        null,
        'text',
        42,
        [],
        { suggestions: 'nope' },
        { suggestions: [null, 'x', 3] },
      ])
        expect(sanitizeInterpretation(raw, 'gin', VOCABULARY)).toEqual({
          term: 'gin',
          summary: '',
          suggestions: [],
        });
    });

    it('caps the length of free text', () => {
      const result = sanitizeInterpretation(
        {
          summary: 'word '.repeat(200),
          suggestions: [
            {
              ingredient: 'Lime',
              relation: 'same',
              reason: 'why '.repeat(100),
            },
          ],
        },
        'Key lime',
        VOCABULARY
      );
      expect(result.summary.length).toBeLessThanOrEqual(
        INTERPRET_LIMITS.summaryLength
      );
      expect(result.suggestions[0].reason.length).toBeLessThanOrEqual(
        INTERPRET_LIMITS.reasonLength
      );
    });
  });
});
