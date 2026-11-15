// Review fix 10: release build checks that need no phone (the rest run on emulators in
// .github/workflows/release-check.yml and in scripts/check-release.sh).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error plain JavaScript modules used by the build
import { PROGUARD_RULES, withShrinking } from '../scripts/android-release.mjs';
// @ts-expect-error plain JavaScript modules used by the build
import { build, minifyCss } from '../scripts/build.mjs';
import { PRINT_INSTEAD, sharePage } from '../src/ui/pdfshare.ts';
import { Voice } from '../src/platform/voice.ts';
import type { App } from '../src/ui/app.ts';
import type { StudyHardPlugin } from '../src/platform/native.ts';

const java = (f: string) => readFileSync(`native/android/java/com/studyhard/app/${f}.java`, 'utf8');

test('the release build is shrunk, keeping what is reached by name', () => {
  const g = withShrinking('android {\n    buildTypes {\n        release {\n            signingConfig x\n        }\n    }\n}\n');
  assert.match(g, /release \{\n {12}minifyEnabled true\n {12}shrinkResources true\n {12}proguardFiles getDefaultProguardFile\('proguard-android-optimize\.txt'\), 'proguard-rules\.pro'\n {12}signingConfig x/);
  assert.throws(() => withShrinking('android {}'), /anchor/);
  for (const keep of ['-keep @com.getcapacitor.annotation.CapacitorPlugin', '@com.getcapacitor.PluginMethod public <methods>', '-keep class android.print.PdfMaker { *; }', '-keep class android.print.PdfMaker$* { *; }', '-keep class com.studyhard.app.** { *; }', '-keep class androidx.credentials.playservices.**']) {
    assert.ok(PROGUARD_RULES.includes(keep), keep);
  }
  const gen = readFileSync('scripts/android.mjs', 'utf8');
  assert.ok(gen.includes('${withShrinking(`') && gen.includes('PROGUARD_RULES'), 'android.mjs applies both');
});

test('the web bundle has no comments, and its CSS is shrunk without touching quoted text', () => {
  assert.equal(minifyCss('/* x */\n.a , .b {\n  content: "  /* kept */  ";\n  color : red ;\n}\n\na :hover { margin: 0 }'), '.a ,.b{content: "  /* kept */  ";color : red;}a :hover{margin: 0}');
  const out = mkdtempSync(join(tmpdir(), 'mn-release-'));
  try {
    build({ outDir: out });
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    // Comments from main.ts and the CSS are gone.
    assert.ok(!html.includes('The app once it exists'), 'a JavaScript comment');
    assert.ok(!html.includes('Tablets and unfolded foldables. Android 16 ignores'), 'a CSS comment');
    assert.ok(html.includes('whosPlayingScreen'), 'the code itself is there');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('when the phone opens its print screen instead of a PDF, the page says so', async () => {
  const toasts: string[] = [];
  const app = { native: { sharePdf: async () => ({ ok: true, via: 'print' as const }) }, toast: (t: string) => toasts.push(t) } as unknown as App;
  assert.equal(await sharePage(app, { html: '<p>x</p>', name: 'Sheet', title: 'Sheet' }), true);
  assert.ok(toasts.includes(PRINT_INSTEAD), toasts.join(' | '));
  toasts.length = 0;
  (app.native as unknown as { sharePdf: () => Promise<unknown> }).sharePdf = async () => ({ ok: true, via: 'share' });
  await sharePage(app, { html: '<p>x</p>', name: 'Sheet', title: 'Sheet' });
  assert.ok(!toasts.includes(PRINT_INSTEAD));
  // The fallback itself (print screen) stays in the native code.
  const plugin = java('StudyHardPlugin');
  assert.match(plugin, /public void fail\(String why\) \{\s*getActivity\(\)\.runOnUiThread\(\(\) -> printInstead\(call, view, title, why\)\);/);
  assert.match(plugin, /r\.put\("via", "print"\);/);
});

test('a phone with no English voice says "none": nothing waits, and the Parent area can say so', async () => {
  const none = { voices: async () => ({ voices: [], state: 'none' }) } as unknown as StudyHardPlugin;
  assert.equal(await new Voice(true, none).state(), 'none');
  assert.equal(await new Voice(true, null).state(), 'unknown');
  const vc = readFileSync('src/ui/voicechoice.ts', 'utf8');
  assert.match(vc, /if \(!found\.length && \(await app\.voice\.state\(\)\) === 'none'\) host\.insertAdjacentHTML\('afterbegin', NO_VOICE_NOTE\);/);
  const plugin = java('StudyHardPlugin');
  assert.ok(!/ttsReady|pendingText/.test(plugin), 'the old flags are gone');
  assert.match(plugin, /String line = voice\.started\(ok, english\);/);
  assert.match(plugin, /r\.put\("speaking", tts != null && voice\.speaking\(tts\.isSpeaking\(\), System\.currentTimeMillis\(\)\)\);/);
  assert.match(plugin, /result\.put\("state", voice\.state\(\)\);/);
});

test('Google sign-in reuses one thread, and reminders replace their own note', () => {
  const plugin = java('StudyHardPlugin');
  assert.ok(!plugin.includes('Executors.newSingleThreadExecutor(), new CredentialManagerCallback'), 'no new thread per call');
  assert.equal(plugin.match(/signInWork, new CredentialManagerCallback/g)?.length, 2);
  assert.match(plugin, /signInWork\.shutdown\(\);/);
  assert.match(java('Reminders'), /notify\(NoteIds\.forItem\(kind, id\), b\.build\(\)\)/);
});

test('the release is checked on emulators: API 24, 34 and 36, and a tablet held sideways', () => {
  const wf = readFileSync('.github/workflows/release-check.yml', 'utf8');
  for (const line of ['{ api: 24,', '{ api: 34,', '{ api: 36, target: google_apis, profile: pixel_7', "profile: pixel_tablet, sideways: 'sideways'", 'assembleRelease', 'scripts/release-smoke.sh']) assert.ok(wf.includes(line), line);
});
