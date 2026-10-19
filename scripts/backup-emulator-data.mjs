/**
 * Backs up the local Firebase emulator data before the emulators start.
 *
 * `npm run emulators` uses --export-on-exit, and on every exit firebase-tools deletes
 * .firebase-emulator/ and puts the session's data in its place, even when the session
 * was empty. So each start keeps a dated copy first, in .firebase-emulator-backups/.
 *
 * Never deletes or overwrites anything. If the copy can't be made and checked, it exits
 * with an error so the emulators don't start without a backup.
 *
 * Run from the project root (npm scripts do this): node scripts/backup-emulator-data.mjs
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATA_DIR = '.firebase-emulator';
export const BACKUP_DIR = '.firebase-emulator-backups';

/** Every file and folder under dir, as relative path → size (-1 for folders). */
function listTree(dir, root = dir, entries = new Map()) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      entries.set(relative(root, path), -1);
      listTree(path, root, entries);
    } else {
      entries.set(relative(root, path), statSync(path).size);
    }
  }
  return entries;
}

/** Counts only: never names or email addresses. */
export function describeData(dir) {
  let accounts = 'unknown';
  try {
    const data = JSON.parse(
      readFileSync(join(dir, 'auth_export', 'accounts.json'), 'utf8')
    );
    if (Array.isArray(data.users)) accounts = String(data.users.length);
  } catch {
    // No auth export, or one we can't read: leave it as unknown.
  }
  // The Firestore emulator only writes this folder when there are documents.
  const documents = existsSync(join(dir, 'firestore_export', 'all_namespaces'));
  const plural = accounts === '1' ? 'account' : 'accounts';
  return `${accounts} ${plural}, Firestore data: ${documents ? 'yes' : 'none'}`;
}

/** Folders firebase-tools leaves in the project root when an export is interrupted. */
export function leftoverExports(root) {
  return readdirSync(root).filter(name => name.startsWith('firebase-export-'));
}

function timestamp(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_` +
    `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  );
}

/** Creates a new, empty backup folder; never reuses an existing one. */
function claimBackupFolder(root) {
  const parent = join(root, BACKUP_DIR);
  mkdirSync(parent, { recursive: true });
  const base = timestamp();
  for (let n = 1; n < 1000; n++) {
    const target = join(parent, n === 1 ? base : `${base}-${n}`);
    try {
      mkdirSync(target); // Fails if it already exists, so nothing is ever overwritten.
      return target;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  throw new Error(`No free backup folder name for ${base}.`);
}

export function backup(root = process.cwd()) {
  const source = join(root, DATA_DIR);
  for (const name of leftoverExports(root))
    console.warn(
      `Note: ${name}/ is an unfinished export left by an interrupted shutdown. It's kept as is.`
    );

  if (!existsSync(source) || !statSync(source).isDirectory()) {
    console.log(
      `No saved emulator data yet (${DATA_DIR}/), so nothing to back up.`
    );
    return { status: 'nothing' };
  }
  const before = listTree(source);
  if (!before.size) {
    console.log(`${DATA_DIR}/ is empty, so nothing to back up.`);
    return { status: 'nothing' };
  }

  let target;
  try {
    target = claimBackupFolder(root);
    cpSync(source, target, {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
    const after = listTree(target);
    const missing = [...before].filter(
      ([path, size]) => after.get(path) !== size
    );
    if (missing.length || after.size !== before.size)
      throw new Error(
        `the copy doesn't match the original (${missing.map(([p]) => p).join(', ') || 'extra files'}).`
      );
  } catch (error) {
    console.error(`Couldn't back up the emulator data: ${error.message}`);
    console.error(
      `The emulators were not started and nothing was deleted. ${DATA_DIR}/ is untouched` +
        (target ? `; any partial copy is in ${relative(root, target)}/.` : '.')
    );
    return { status: 'failed', target };
  }

  console.log(
    `Backed up ${DATA_DIR}/ to ${relative(root, target)}/ (${describeData(target)}).`
  );
  return { status: 'backed-up', target };
}

// Runs only when called directly, so dev-check can import the helpers above.
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === realpathSync(process.argv[1])
) {
  if (backup().status === 'failed') process.exitCode = 1;
}
