import { BartenderAnswer } from '../../app/core/ai/ai-recipe';
import {
  Generate,
  GenerateBusyError,
  GenerateQuotaError,
  GenerateTimeoutError,
} from '../ingredient-interpreter/handler';
import { RateLimiter } from '../ingredient-interpreter/rate-limiter';
import { BartenderDeps, handleCreateDrink } from './bartender';

const CLIENT = {
  id: '1.2.3.4',
  origin: 'https://bytheglass.test',
  host: 'bytheglass.test',
};

const MOGU = {
  name: 'Jelly Lime Cooler',
  kind: 'mocktail',
  description:
    'Mogu Mogu lengthened with lime and soda; the coconut jelly stays.',
  ingredients: [
    { name: 'Mogu Mogu', amount: '1 bottle (320 ml)', optional: false },
    { name: 'Lime', amount: '1/2, juiced', optional: false },
    { name: 'Soda water', amount: 'Top up', optional: true },
  ],
  steps: [
    'Fill a highball with ice.',
    'Add lime and Mogu Mogu.',
    'Top with soda.',
  ],
  glass: 'Highball',
  ice: 'Over cubed ice',
  garnish: 'Lime wheel',
  serving: 'Serve with a wide straw for the jelly.',
};

const answer = (value: unknown): Generate =>
  jasmine.createSpy('generate').and.resolveTo(JSON.stringify(value));

function deps(generate?: Generate, perClient = 100): BartenderDeps {
  return {
    generate,
    perClient: new RateLimiter(perClient, 60_000),
    global: new RateLimiter(1000, 60_000),
  };
}

const BODY = {
  ingredients: ['Mogu Mogu', 'Lime'],
  type: 'mocktail',
  tastes: ['Sour'],
};

describe('AI Bartender: create a drink', () => {
  it('is unavailable without a Gemini key', async () => {
    expect((await handleCreateDrink(BODY, CLIENT, deps())).status).toBe(503);
  });

  it('turns away bad requests and other sites', async () => {
    const d = deps(answer(MOGU));
    for (const body of [
      {},
      { ...BODY, ingredients: [] },
      { ...BODY, type: 'shot' },
      { ...BODY, ingredients: Array.from({ length: 21 }, (_, i) => `x${i}`) },
    ])
      expect((await handleCreateDrink(body, CLIENT, d)).status).toBe(400);
    const other = { ...CLIENT, origin: 'https://elsewhere.test' };
    expect((await handleCreateDrink(BODY, other, d)).status).toBe(403);
  });

  it('creates a drink that keeps Mogu Mogu itself, even with no matching recipe', async () => {
    const generate = answer(MOGU);
    const result = await handleCreateDrink(BODY, CLIENT, deps(generate));
    expect(result.status).toBe(200);
    const body = result.body as BartenderAnswer;
    expect(body.basedOn).toEqual(['Mogu Mogu', 'Lime']);
    expect(body.recipe.ingredients[0]).toEqual({
      name: 'Mogu Mogu',
      amount: '1 bottle (320 ml)',
      origin: 'given',
      optional: false,
    });
    expect(body.recipe.ingredients[2].origin).toBe('extra');
    const { prompt, system } = (generate as jasmine.Spy).calls.mostRecent()
      .args[0];
    expect(prompt).toContain('"Mogu Mogu"');
    expect(prompt).toContain('TYPE: "mocktail"');
    expect(prompt).toContain('TASTES: ["Sour"]');
    expect(system).toContain('Never swap one of the person');
  });

  it('never passes on an answer that fails validation', async () => {
    const withRum = {
      ...MOGU,
      ingredients: [
        ...MOGU.ingredients,
        { name: 'White rum', amount: '30 ml', optional: true },
      ],
    };
    for (const generate of [
      answer(withRum),
      answer({ ...MOGU, serving: 'About ₹200 at most bars' }),
      answer({ ...MOGU, kind: 'cocktail' }),
      jasmine.createSpy('generate').and.resolveTo('not json') as Generate,
    ]) {
      const result = await handleCreateDrink(BODY, CLIENT, deps(generate));
      expect(result).toEqual({
        status: 502,
        body: { error: 'upstream-error' },
        retryAfter: undefined,
      });
    }
  });

  it('reports Google failures with their own codes', async () => {
    const failing = (error: Error) =>
      deps(jasmine.createSpy('generate').and.rejectWith(error) as Generate);
    expect(
      await handleCreateDrink(BODY, CLIENT, failing(new GenerateBusyError(30)))
    ).toEqual({
      status: 503,
      body: { error: 'busy' },
      retryAfter: 30,
    });
    expect(
      (
        await handleCreateDrink(
          BODY,
          CLIENT,
          failing(new GenerateQuotaError(60))
        )
      ).status
    ).toBe(429);
    expect(
      (
        await handleCreateDrink(
          BODY,
          CLIENT,
          failing(new GenerateTimeoutError())
        )
      ).status
    ).toBe(504);
  });

  it('limits how often one visitor can ask', async () => {
    const d = deps(answer(MOGU), 1);
    expect((await handleCreateDrink(BODY, CLIENT, d)).status).toBe(200);
    const second = await handleCreateDrink(BODY, CLIENT, d);
    expect(second.status).toBe(429);
    expect(second.body).toEqual({ error: 'rate-limited' });
  });
});
