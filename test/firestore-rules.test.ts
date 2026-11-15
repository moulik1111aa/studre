// Review fix 9: the cloud rules, checked without the emulator (the emulator tests are in
// test/rules/firestore.test.mjs and run in .github/workflows/rules.yml).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHILD_ID } from '../src/core/clean.ts';

const rules = readFileSync('firestore.rules', 'utf8');
const code = rules.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

test('no rule names an email address; the owner is an account id filled in when published', () => {
  assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(rules), 'no address in the rules');
  assert.match(code, /function isOwner\(\) \{\s*return signedIn\(\) && request\.auth\.uid == '__OWNER_UID__';/);
  const site = readFileSync('.github/workflows/site.yml', 'utf8');
  assert.match(site, /OWNER_UID: \$\{\{ secrets\.OWNER_UID \}\}/);
  assert.match(site, /sed -i "s\/__OWNER_UID__\/\$OWNER_UID\/g" firestore\.rules/);
  assert.match(site, /grep -q '__OWNER_UID__' firestore\.rules && \{ echo "::error::/, 'the placeholder is never published');
});

test('a child id in the rules is the same pattern as the app’s', () => {
  const m = /function childId\(v\) \{\s*return v is string && v\.matches\('([^']+)'\);/.exec(code);
  assert.ok(m);
  assert.equal(m[1], CHILD_ID.source);
});

test('the limits the review asks for', () => {
  assert.match(code, /data\(\)\.data is bytes\s*&& data\(\)\.data\.size\(\) < 900000;/, 'a child backup under 900 KB');
  assert.match(code, /optText\('rules', 20000\)/, 'family rules under 20 KB');
  assert.match(code, /childTimes\(data\(\)\.kids, 20\)/, 'at most 20 children');
  assert.match(code, /data\(\)\.childId == child/);
  assert.match(code, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/, 'everything else closed');
});

test('the emulator tests run on every change to the rules', () => {
  const wf = readFileSync('.github/workflows/rules.yml', 'utf8');
  assert.match(wf, /paths: \['firestore\.rules', 'test\/rules\/\*\*'/);
  assert.match(wf, /emulators:exec --only firestore --project demo-mn "node --test test\/rules\/"/);
});
