import { iceFrom, servingFrom } from './recipe-details';

const ingredients = (...names: string[]) => names.map(name => ({ name }));

describe('ice and serving notes from a recipe’s own method', () => {
  it('reads how ice is used, and only that', () => {
    expect(iceFrom('Shake with ice and strain into a chilled glass.', [])).toBe(
      'Shaken with ice; strained'
    );
    expect(iceFrom('Stir into glass over ice, garnish and serve.', [])).toBe(
      'Stirred with ice; served over ice'
    );
    expect(
      iceFrom(
        'Muddle mint. Fill the glass with cracked ice. Top with soda.',
        []
      )
    ).toBe('Served over ice');
    expect(
      iceFrom(
        'Blend at high speed until smooth.',
        ingredients('Light rum', 'Ice')
      )
    ).toBe('Blended with ice');
    expect(iceFrom('Mix with crushed ice in blender until smooth.', [])).toBe(
      'Blended with ice'
    );
  });

  it('never claims "no ice" just because the method doesn’t mention it', () => {
    expect(
      iceFrom('Pour into a shot glass.', ingredients('Vodka'))
    ).toBeUndefined();
    expect(iceFrom(undefined, [])).toBeUndefined();
    // Ice cream is not ice.
    expect(iceFrom('Blend with vanilla ice cream.', [])).toBeUndefined();
  });

  it('reads serving notes only when the method gives them', () => {
    expect(servingFrom('Heat the coffee and whiskey; serve hot.')).toBe(
      'Served hot'
    );
    expect(
      servingFrom('Simmer the wine with the spices for ten minutes.')
    ).toBe('Served hot');
    expect(servingFrom('Pour into chilled glass, garnish and serve.')).toBe(
      'In a chilled glass'
    );
    expect(servingFrom('Serve immediately.')).toBe('Straight away');
    expect(servingFrom('Stir and strain.')).toBeUndefined();
    // Heated, then chilled: not served hot.
    expect(
      servingFrom('Heat the syrup, let it cool, then chill.')
    ).toBeUndefined();
  });
});
