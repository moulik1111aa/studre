// Review fix 6: what MN offers to receive, and which of its files the FileProvider can hand out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error plain JavaScript module used by the Android build script
import { FILE_PATHS_XML, SHARE_MIMES, shareFilters } from '../scripts/android-share.mjs';

test('MN is offered in the share sheet for its backup files only, not for any text or file', () => {
  assert.deepEqual(SHARE_MIMES, ['text/html', 'application/json']);
  const xml: string = shareFilters();
  assert.ok(!xml.includes('text/plain'), 'not offered for plain text');
  assert.ok(!xml.includes('application/octet-stream'), 'not offered for any file');
  assert.ok(!xml.includes('*/*'));
  assert.equal((xml.match(/android\.intent\.action\.SEND"/g) ?? []).length, 2);
  // Open with: content links only.
  const view = xml.slice(xml.indexOf('action.VIEW'));
  assert.ok(!/android:scheme="(file|http|https)"/.test(view));
  assert.equal((view.match(/android:scheme="content"/g) ?? []).length, 2);
});

test('the FileProvider exposes only the cache/share folder', () => {
  const paths = [...FILE_PATHS_XML.matchAll(/<([a-z-]+-path) name="([^"]+)" path="([^"]*)"/g)].map((m) => m.slice(1));
  assert.deepEqual(paths, [['cache-path', 'mn_share', 'share/']]);
  assert.ok(!FILE_PATHS_XML.includes('external-path'));
  assert.ok(!/path="\.?"/.test(FILE_PATHS_XML), 'no whole folder');
});
