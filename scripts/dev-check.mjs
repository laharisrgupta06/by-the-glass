/**
 * Reports which local development servers are running and what's missing.
 * Read-only: it starts, stops and changes nothing, and never prints secrets.
 *
 * Run from the project root: npm run dev:check
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { connect } from 'node:net';
import { join } from 'node:path';

import {
  BACKUP_DIR,
  DATA_DIR,
  describeData,
  leftoverExports,
} from './backup-emulator-data.mjs';

const root = process.cwd();

const SERVICES = [
  {
    port: 4200,
    name: 'App (ng serve)',
    start: 'npm start',
    neededFor: 'the app with live reload',
  },
  {
    port: 4000,
    name: 'API server',
    start: 'npm run api:dev',
    neededFor: '"Ask our bartender" (the /api routes)',
  },
  {
    port: 9099,
    name: 'Auth emulator',
    start: 'npm run emulators',
    neededFor: 'sign-in in development builds',
  },
  {
    port: 8080,
    name: 'Firestore emulator',
    start: 'npm run emulators',
    neededFor: 'favorites in development builds',
  },
  {
    port: 9199,
    name: 'Storage emulator',
    start: 'npm run emulators',
    neededFor: 'photos on your own recipes in development builds',
  },
];

function portOpen(port, host) {
  return new Promise(resolve => {
    const socket = connect({ port, host });
    const done = open => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(1500, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

/** IPv4 or IPv6: "localhost" can mean either, depending on the server. */
async function listening(port) {
  return (await portOpen(port, '127.0.0.1')) || (await portOpen(port, '::1'));
}

/** Which process holds a port (macOS and Linux; skipped where lsof isn't available). */
function owner(port) {
  try {
    const out = execFileSync(
      'lsof',
      ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpc'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const pid = out.match(/^p(\d+)/m)?.[1];
    const command = out.match(/^c(.+)$/m)?.[1];
    return pid ? `${command ?? 'process'} pid ${pid}` : '';
  } catch {
    return '';
  }
}

async function get(url, ms) {
  const started = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(ms) });
    const body = await response.text();
    return {
      status: response.status,
      body,
      seconds: (Date.now() - started) / 1000,
    };
  } catch (error) {
    return { error: error.name === 'TimeoutError' ? 'timeout' : 'failed' };
  }
}

function geminiKeySet() {
  const path = join(root, '.env');
  if (!existsSync(path)) return 'no .env file';
  const line = readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .find(l => /^\s*GEMINI_API_KEY\s*=/.test(l));
  const value = line
    ?.split('=')
    .slice(1)
    .join('=')
    .trim()
    .replace(/^["']|["']$/g, '');
  return value ? 'GEMINI_API_KEY is set' : 'GEMINI_API_KEY is empty';
}

const status = new Map();
console.log(
  `By the Glass: local development check (Node ${process.version})\n`
);

for (const service of SERVICES) {
  const up = await listening(service.port);
  status.set(service.port, up);
  const who = up ? owner(service.port) : '';
  console.log(
    `${up ? '✓' : '✗'} ${service.name} on port ${service.port}: ${up ? 'running' : 'not running'}` +
      (who ? ` (${who})` : '')
  );
}
console.log('');

if (status.get(4200)) {
  const page = await get('http://localhost:4200/', 20_000);
  if (page.error === 'timeout')
    console.log(
      '! The app is on port 4200 but took over 20 seconds to answer. Check the ng serve terminal for errors.'
    );
  else if (page.error)
    console.log(
      '! Port 4200 is open but not answering HTTP. Check the ng serve terminal.'
    );
  else
    console.log(
      `  App answered ${page.status} in ${page.seconds.toFixed(1)}s.`
    );
}

if (status.get(4000)) {
  const api = await get(
    'http://localhost:4000/api/ingredients/interpret/status',
    5_000
  );
  let available;
  try {
    available = JSON.parse(api.body ?? '').available;
  } catch {
    // Not our API answering.
  }
  if (available === true)
    console.log('  Bartender: available (the API has a Gemini key).');
  else if (available === false)
    console.log(
      '  Bartender: off. The API server has no GEMINI_API_KEY; set it in .env and restart.'
    );
  else
    console.log(
      '! Something on port 4000 answered, but not as our API. Is another app using the port?'
    );
} else if (status.get(4200)) {
  console.log(
    '  Bartender: hidden. Without the API server, ng serve logs "[vite] http proxy error … ECONNREFUSED". That\'s expected.'
  );
}
console.log(`  .env: ${geminiKeySet()} (the value is never shown).`);

const auth = status.get(9099);
const firestore = status.get(8080);
if (firestore && !auth)
  console.log(
    `! Firestore is running without Auth, which usually means a leftover emulator (${owner(8080) || 'see lsof -i :8080'}).\n` +
      '  npm run emulators will fail until it stops. Anything it holds in memory is lost when it stops.'
  );
if (auth && !firestore)
  console.log(
    '! Auth is running without Firestore. Restart the emulators with npm run emulators.'
  );

const dataDir = join(root, DATA_DIR);
console.log(
  `\nEmulator data: ${existsSync(dataDir) ? `${DATA_DIR}/ (${describeData(dataDir)})` : 'none saved yet'}`
);
const backups = existsSync(join(root, BACKUP_DIR))
  ? readdirSync(join(root, BACKUP_DIR)).sort()
  : [];
console.log(
  `Backups: ${backups.length ? `${backups.length}, latest ${BACKUP_DIR}/${backups.at(-1)}/` : 'none yet'}`
);
for (const name of leftoverExports(root))
  console.log(`Unfinished export kept from an interrupted shutdown: ${name}/`);

const missing = SERVICES.filter(s => !status.get(s.port));
if (missing.length) {
  console.log('\nTo start what is missing, each in its own terminal:');
  for (const command of [...new Set(missing.map(s => s.start))]) {
    const forWhat = missing
      .filter(s => s.start === command)
      .map(s => s.neededFor);
    console.log(`  ${command.padEnd(18)} ${forWhat.join('; ')}`);
  }
  console.log('Stop the emulators with Ctrl+C so the session is saved.');
} else {
  console.log('\nEverything is running.');
}
