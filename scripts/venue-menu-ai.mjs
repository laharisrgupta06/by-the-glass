/**
 * Creates AI-curated recipes or AI-generated illustrations for venue-menu drinks
 * through the running API server (npm run api:dev), which holds the Gemini key; this
 * script never sees it. Anything already stored is skipped: nothing is regenerated.
 *
 *   npm run menu:recipes                      every menu drink still without a recipe
 *   npm run menu:illustrate -- <drink id>     one illustration (the server must run
 *                                             with VENUE_MENU_ILLUSTRATIONS=on)
 *
 * Optional: --api http://localhost:4000
 */
const args = process.argv.slice(2);
const apiFlag = args.indexOf('--api');
const api = (
  apiFlag >= 0 ? args[apiFlag + 1] : 'http://localhost:4000'
).replace(/\/$/, '');
const [command, id] = args.filter(
  (a, i) => !a.startsWith('--') && args[i - 1] !== '--api'
);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function call(method, path) {
  const response = await fetch(api + path, {
    method,
    signal: AbortSignal.timeout(120_000),
  });
  const body = await response.json().catch(() => ({}));
  return {
    status: response.status,
    body,
    retryAfter: Number(response.headers.get('retry-after')) || 0,
  };
}

async function index() {
  const { status, body } = await call('GET', '/api/venue-menu');
  if (status !== 200 || !Array.isArray(body.drinks))
    throw new Error(
      `The API at ${api} didn't list the menu (HTTP ${status}). Is npm run api:dev running?`
    );
  return body.drinks;
}

async function recipes() {
  const drinks = await index();
  const missing = drinks.filter(d => !d.hasRecipe);
  console.log(
    `${drinks.length} menu drinks; ${drinks.length - missing.length} already have a recipe; ${missing.length} to create.`
  );
  const failed = [];
  for (const [n, drink] of missing.entries()) {
    let result;
    for (let attempt = 1; attempt <= 2; attempt++) {
      result = await call(
        'POST',
        `/api/venue-menu/${encodeURIComponent(drink.id)}/recipe`
      );
      const code = result.body?.error;
      // Overloaded or rate-limited: wait as told (at most 90 s) and try once more.
      if ((code === 'busy' || code === 'rate-limited') && attempt === 1) {
        const wait = Math.min(result.retryAfter || 30, 90);
        console.log(`  ${drink.name}: ${code}; waiting ${wait} s.`);
        await sleep(wait * 1000);
        continue;
      }
      break;
    }
    const ok = result.status === 200 || result.status === 201;
    console.log(
      `${n + 1}/${missing.length} ${drink.name}: ${ok ? (result.status === 201 ? 'created' : 'already stored') : `not created (${result.body?.error ?? result.status})`}`
    );
    if (!ok)
      failed.push(`${drink.id} (${result.body?.error ?? result.status})`);
    if (result.body?.error === 'quota') {
      console.log(
        'The Gemini quota is used up; stopping. Run again later: stored recipes are kept.'
      );
      break;
    }
    await sleep(4000); // gentle on the free tier
  }
  console.log(failed.length ? `Not created: ${failed.join(', ')}` : 'Done.');
  process.exitCode = failed.length ? 1 : 0;
}

async function illustrate() {
  if (!id)
    throw new Error(
      'Name the drink: npm run menu:illustrate -- bg-menu-after-hours'
    );
  const { status, body } = await call(
    'POST',
    `/api/venue-menu/${encodeURIComponent(id)}/illustration`
  );
  if (status === 200)
    console.log(
      `${id}: already has an illustration (${body.url}); nothing generated.`
    );
  else if (status === 201)
    console.log(
      `${id}: AI-generated illustration created with ${body.model}: ${api}${body.url}`
    );
  else {
    console.log(
      `${id}: not created (${body?.error ?? status}).${body?.error === 'disabled' ? ' Start the server with VENUE_MENU_ILLUSTRATIONS=on.' : ''}`
    );
    process.exitCode = 1;
  }
}

const run = { recipes, illustrate }[command];
if (!run) {
  console.log(
    'Usage: node scripts/venue-menu-ai.mjs recipes | illustrate <drink id> [--api http://localhost:4000]'
  );
  process.exitCode = 1;
} else {
  run().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
