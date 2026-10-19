import express, {
  ErrorRequestHandler,
  Request,
  Response,
  Router,
} from 'express';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BARTENDER_PATHS } from '../../app/core/ai/ai-recipe';
import {
  IngredientInterpretation,
  INTERPRET_PATHS,
} from '../../app/core/ai/ingredient-interpretation';
import { BartenderDeps, handleCreateDrink } from '../ai-recipes/bartender';
import { MenuStore } from '../ai-recipes/menu-store';
import {
  MenuDeps,
  findDrink,
  handleCreateIllustration,
  handleCreateMenuRecipe,
  handleMenuExtras,
  handleMenuIndex,
} from '../ai-recipes/venue-menu';
import {
  DEFAULT_FALLBACK_MODELS,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_IMAGE_MODELS,
  createGeminiGenerator,
  createGeminiImageGenerator,
} from './gemini';
import {
  HandlerResult,
  InterpreterDeps,
  handleInterpret,
  statusBody,
} from './handler';
import { modelList } from './model-pool';
import { RateLimiter } from './rate-limiter';
import { TtlCache } from './ttl-cache';

const API_PREFIX = '/api';

/** Empty or unset means the default fallbacks; "none" switches them off. */
function fallbackSetting(value: string | undefined): string {
  const setting = value?.trim() ?? '';
  if (!setting) return DEFAULT_FALLBACK_MODELS;
  return setting.toLowerCase() === 'none' ? '' : setting;
}
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Where the venue-menu recipes are: VENUE_MENU_GENERATED_DIR if set, else the
 * venue-menu-generated folder in the working directory, else the one in the project
 * root next to the build (dist/by-the-glass/server/), so a host that starts the server
 * from another directory still finds the published recipes.
 */
function generatedDir(env: NodeJS.ProcessEnv): string {
  const configured = env['VENUE_MENU_GENERATED_DIR']?.trim();
  if (configured) return configured;
  const candidates = [join(process.cwd(), 'venue-menu-generated')];
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    candidates.push(resolve(here, '../../../venue-menu-generated'));
  } catch {
    // Not running from a file URL (e.g. in tests): the working directory it is.
  }
  return (
    candidates.find(dir => existsSync(join(dir, 'recipes'))) ?? candidates[0]
  );
}

function countRecipes(dir: string): number {
  try {
    return readdirSync(join(dir, 'recipes')).filter(
      f => f.endsWith('.json') && !f.includes('.stale-')
    ).length;
  } catch {
    return 0;
  }
}

const LOOPBACK = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

/** Who's asking, for rate limits and same-origin checks. */
function clientOf(req: Request) {
  return {
    id: req.ip ?? 'unknown',
    origin: req.get('origin'),
    host: req.get('host'),
    // This machine, not through a forwarding proxy.
    local:
      LOOPBACK.includes(req.socket.remoteAddress ?? '') &&
      !req.get('x-forwarded-for'),
  };
}

function send(res: Response, result: HandlerResult<unknown>): void {
  if (result.retryAfter) res.set('Retry-After', String(result.retryAfter));
  res.status(result.status).set('Cache-Control', 'no-store').json(result.body);
}

/**
 * The server-only /api routes: ingredient interpretation, the AI Bartender, and
 * AI-curated recipes and illustrations for venue-menu drinks. Reads GEMINI_API_KEY (and
 * optionally GEMINI_MODEL, GEMINI_FALLBACK_MODELS, GEMINI_IMAGE_MODELS,
 * VENUE_MENU_ILLUSTRATIONS and VENUE_MENU_GENERATED_DIR) from the server environment;
 * without a key the AI features report themselves unavailable and the site carries on.
 */
export function ingredientApi(env: NodeJS.ProcessEnv = process.env): Router {
  const apiKey = env['GEMINI_API_KEY']?.trim();
  const models = modelList(
    env['GEMINI_MODEL']?.trim() || DEFAULT_GEMINI_MODEL,
    fallbackSetting(env['GEMINI_FALLBACK_MODELS'])
  );
  // One generator (and one model pool) for every text feature.
  const generate = apiKey
    ? createGeminiGenerator({ apiKey, models })
    : undefined;
  const deps: InterpreterDeps = {
    generate,
    cache: new TtlCache<IngredientInterpretation>(500, DAY_MS),
    // Per visitor, and a ceiling for everyone to cap cost.
    perClient: new RateLimiter(8, 60_000),
    global: new RateLimiter(60, 60_000),
  };
  const bartender: BartenderDeps = {
    generate,
    perClient: new RateLimiter(5, 60_000),
    global: new RateLimiter(30, 60_000),
  };
  const illustrationsEnabled =
    env['VENUE_MENU_ILLUSTRATIONS']?.trim().toLowerCase() === 'on';
  const imageModels = (
    env['GEMINI_IMAGE_MODELS']?.trim() || DEFAULT_IMAGE_MODELS
  )
    .split(',')
    .map(m => m.trim())
    .filter(Boolean);
  const menuDir = generatedDir(env);
  const store = new MenuStore(menuDir);
  console.log(
    `Venue-menu recipes: ${countRecipes(menuDir)} stored in ${menuDir}.`
  );
  const menu: MenuDeps = {
    store,
    generate,
    generateImage:
      apiKey && illustrationsEnabled
        ? createGeminiImageGenerator({ apiKey, models: imageModels })
        : undefined,
    illustrationsEnabled,
    recipeLimiter: new RateLimiter(6, 60_000),
    imageLimiter: new RateLimiter(2, 60_000),
  };
  console.log(
    apiKey
      ? `AI features: on (Gemini models, in order: ${models.join(', ')}).`
      : 'AI features: off (GEMINI_API_KEY is not set).'
  );
  console.log(
    illustrationsEnabled && apiKey
      ? `Venue-menu illustrations: can be made on request from this machine (${imageModels.join(', ')}).`
      : 'Venue-menu illustrations: making new ones is off (VENUE_MENU_ILLUSTRATIONS is not "on"); stored ones are still served.'
  );

  const router = express.Router();
  const path = (full: string) => full.slice(API_PREFIX.length);

  router.get(path(INTERPRET_PATHS.status), (_req, res) => {
    res.set('Cache-Control', 'no-store').json(statusBody(deps));
  });

  router.post(
    path(INTERPRET_PATHS.interpret),
    express.json({ limit: '32kb' }),
    async (req, res) => {
      send(res, await handleInterpret(req.body, clientOf(req), deps));
    }
  );

  router.post(
    path(BARTENDER_PATHS.create),
    express.json({ limit: '32kb' }),
    async (req, res) => {
      send(res, await handleCreateDrink(req.body, clientOf(req), bartender));
    }
  );

  router.get('/venue-menu', async (_req, res) => {
    send(res, await handleMenuIndex(menu));
  });
  router.get('/venue-menu/:id/extras', async (req, res) => {
    send(res, await handleMenuExtras(req.params['id'], menu));
  });
  router.post('/venue-menu/:id/recipe', async (req, res) => {
    send(
      res,
      await handleCreateMenuRecipe(req.params['id'], clientOf(req), menu)
    );
  });
  router.post('/venue-menu/:id/illustration', async (req, res) => {
    send(
      res,
      await handleCreateIllustration(req.params['id'], clientOf(req), menu)
    );
  });
  router.get('/venue-menu/:id/illustration', async (req, res) => {
    const drink = findDrink(req.params['id']);
    const type = drink && (await store.illustrationType(drink));
    if (!drink || !type || !(await store.readIllustration(drink))) {
      res.status(404).json({ error: 'not-found' });
      return;
    }
    res
      .type(type)
      .set('Cache-Control', 'public, max-age=86400')
      .sendFile(store.imageFile(drink));
  });

  // Unknown API paths answer as an API, not with the Angular app.
  router.use((_req, res) => {
    res.status(404).json({ error: 'not-found' });
  });

  // Malformed or oversized JSON bodies.
  // Express recognises error handlers by their four parameters, so _next stays.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    const status = (error as { status?: number }).status === 413 ? 413 : 400;
    res.status(status).json({ error: 'invalid-request' });
  };
  router.use(errors);

  return router;
}

export { API_PREFIX };
