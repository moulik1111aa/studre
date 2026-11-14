// Checks the Google Play build (MN_STORE=play) has no access keys, owner tools or test hooks
// (security review fix 7). Two checks:
//  1. The sources as the Play build sees them (X.play.ts swaps, `#unless play` blocks removed)
//     still type-check, so removing a block can't leave a call to something that isn't there.
//  2. The Play bundle (index.html) contains none of the forbidden strings below, nor the
//     owner's email address (read from the code, never written here).
// Run: node scripts/check-play.mjs   (exits 1 on any problem). CI runs it in the Play job.
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');

/** Words that must not appear anywhere in the Play bundle (code, strings or comments). A RegExp
 * where a plain word would also match an innocent one (lockScreen inside unlockScreen). */
export const FORBIDDEN = [
  // from the review
  'SHMK-', 'isOwnerCode', 'cloudmock', '__share', 'mockplay', 'storepreview',
  // the rest of the keyed path and the test hooks
  'OWNER_EMAIL', 'ownerHook', 'accessState', /\blockScreen\b/, 'phoneCode', 'checkKey', 'signingKey',
  'myAccess', 'requestAccess', 'checkIn(', 'listAccess', 'listRequests', 'listCheckins', 'ownerKeys', 'approve(',
  '__app', '__screens', '__mockGoogle', '__mockBilling', '__syncNow', '__lesson', '__showLesson', '__opener', '__swipe',
  'seedDemo', 'MemoryCloud', 'MockBilling', 'studyhard.mockcloud', 'Tester made',
];

/** The owner's email, from the shared build's code (it must not reach the Play bundle). */
export function ownerEmail() {
  const m = /OWNER_EMAIL\s*=\s*'([^']+)'/.exec(readFileSync(join(src, 'platform', 'cloudapi.ts'), 'utf8'));
  if (!m) throw new Error('OWNER_EMAIL not found in src/platform/cloudapi.ts');
  return m[1];
}

/** Forbidden things found in a bundle's text: [{ word, count }]. */
export function scan(html) {
  const words = [...FORBIDDEN, ownerEmail()];
  return words
    .map((w, i) => ({
      word: i === words.length - 1 ? "the owner's email" : String(w),
      count: w instanceof RegExp ? (html.match(new RegExp(w.source, 'g')) ?? []).length : html.split(w).length - 1,
    }))
    .filter((x) => x.count > 0);
}

/** Type-check the sources as the Play build sees them, from src/main.ts (so files only the shared
 * build uses, like the owner area, are left out as they are from its bundle). Returns the
 * compiler's messages ('' when clean). */
export async function typecheckPlay() {
  const { sourceFor } = await import('./build.mjs');
  const work = mkdtempSync(join(tmpdir(), 'mn-play-'));
  try {
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const abs = join(dir, name);
        const rel = relative(src, abs);
        if (rel === 'admin') continue; // the owner's web page is a separate build, never in the app
        if (statSync(abs).isDirectory()) walk(abs);
        else if (name.endsWith('.play.ts')) continue;
        else if (name.endsWith('.ts')) {
          const out = join(work, 'src', rel);
          cpSync(abs, out); // makes the folders
          writeFileSync(out, sourceFor(abs, true));
        }
      }
    };
    walk(src);
    const cfg = JSON.parse(readFileSync(join(root, 'tsconfig.json'), 'utf8'));
    writeFileSync(join(work, 'tsconfig.json'), JSON.stringify({ ...cfg, include: ['src'] }));
    const ts = createRequire(import.meta.url)('typescript');
    const parsed = ts.getParsedCommandLineOfConfigFile(join(work, 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
    const program = ts.createProgram([join(work, 'src', 'main.ts')], parsed.options);
    const diags = ts.getPreEmitDiagnostics(program);
    return diags.length
      ? ts.formatDiagnostics(diags, { getCanonicalFileName: (f) => f, getCurrentDirectory: () => work, getNewLine: () => '\n' }).replaceAll(work + '/', '')
      : '';
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Build the Play bundle into a temporary folder and return its index.html text. */
export async function playBundle() {
  const before = process.env.MN_STORE;
  process.env.MN_STORE = 'play';
  const out = mkdtempSync(join(tmpdir(), 'mn-play-out-'));
  try {
    const { build } = await import('./build.mjs');
    build({ outDir: out });
    return readFileSync(join(out, 'index.html'), 'utf8');
  } finally {
    if (before === undefined) delete process.env.MN_STORE;
    else process.env.MN_STORE = before;
    rmSync(out, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let bad = 0;
  const tc = await typecheckPlay();
  if (tc) {
    bad++;
    console.error('The Play build’s sources don’t type-check:\n' + tc);
  } else console.log('ok - the Play build’s sources type-check');
  const found = scan(await playBundle());
  if (found.length) {
    bad++;
    console.error('The Play bundle still contains: ' + found.map((f) => `${f.word} (${f.count})`).join(', '));
  } else console.log(`ok - the Play bundle contains none of the ${FORBIDDEN.length + 1} forbidden strings`);
  process.exit(bad ? 1 : 0);
}
