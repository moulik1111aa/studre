// The website's protections (review fix 18): no other site may show its pages in a frame
// (MN Access above all), and MN Access's stand-in cloud works only on this computer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isLocal } from '../src/admin/local.ts';

type Rule = { source?: string; regex?: string; headers: { key: string; value: string }[] };
const hosting = JSON.parse(readFileSync('firebase.json', 'utf8')).hosting as { headers: Rule[] };

/** The headers a path gets (regex rules only: the frame rule is one). */
const headersFor = (path: string) =>
  Object.fromEntries(hosting.headers.filter((r) => r.regex && new RegExp(r.regex).test(path)).flatMap((r) => r.headers.map((h) => [h.key, h.value])));

test('every page of the site refuses to be shown inside another site', () => {
  for (const path of ['/', '/privacy', '/delete', '/admin', '/admin/', '/admin/index.html']) {
    const h = headersFor(path);
    assert.equal(h['X-Frame-Options'], 'DENY', path);
    assert.equal(h['Content-Security-Policy'], "frame-ancestors 'none'", path);
    assert.equal(h['X-Content-Type-Options'], 'nosniff', path);
  }
});

test('Firebase’s own sign-in pages (which MN Access frames) are left alone', () => {
  for (const path of ['/__/auth/iframe', '/__/auth/handler', '/__/firebase/init.json']) assert.deepEqual(headersFor(path), {}, path);
});

test('MN Access is never cached or indexed', () => {
  for (const source of ['/admin', '/admin/**']) {
    const r = hosting.headers.find((x) => x.source === source);
    assert.ok(r, source);
    assert.deepEqual(Object.fromEntries(r!.headers.map((h) => [h.key, h.value])), { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  }
});

test('the stand-in cloud (?mock) only on this computer', () => {
  for (const h of ['localhost', '127.0.0.1', '[::1]', '', 'mn.localhost']) assert.ok(isLocal(h), h);
  for (const h of ['mn-mission-next.web.app', 'mn-mission-next.firebaseapp.com', 'localhost.evil.com', 'example.com']) assert.ok(!isLocal(h), h);
});

test('MN Access only makes the stand-in cloud when it is local', () => {
  const src = readFileSync('src/admin/main.ts', 'utf8');
  assert.match(src, /const mock = params\.has\('mock'\) && isLocal\(location\.hostname\);/);
  assert.equal((src.match(/new MemoryCloud\(/g) ?? []).length, 1);
  assert.match(src, /mock \? new MemoryCloud\(/);
});
