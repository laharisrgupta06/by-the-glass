/**
 * Makes sure the local venue-menu data file exists, so development builds and tests
 * (which swap it in; see angular.json) work in a fresh clone.
 *
 * The real menu lives only in venue-menu.data.local.ts, which Git ignores. When that
 * file is missing, this copies the tracked, empty placeholder there. It never
 * overwrites an existing file, so real menu data is never touched.
 *
 * Runs on npm install, npm start and npm test; or by hand: node scripts/ensure-venue-menu-local.mjs
 */
import { constants, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'src/app/featured/products/data/venue-menu');
const placeholder = join(dir, 'venue-menu.data.ts');
const local = join(dir, 'venue-menu.data.local.ts');

if (!existsSync(local)) {
  // COPYFILE_EXCL: fail rather than overwrite, should the file appear meanwhile.
  copyFileSync(placeholder, local, constants.COPYFILE_EXCL);
  console.log(
    'Created venue-menu.data.local.ts from the empty placeholder (no venue-menu drinks).'
  );
}
