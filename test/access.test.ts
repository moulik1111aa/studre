import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toB32, fromB32, tidyPhone, dayNo, dayOf, phoneCode, checkKey, isOwnerCode, signingKey } from '../src/core/access.ts';

test('base 32 and phone codes', async () => {
  for (const len of [1, 3, 5, 8, 69]) {
    const b = crypto.getRandomValues(new Uint8Array(len));
    assert.deepEqual([...fromB32(toB32(b))!].slice(0, len), [...b]);
  }
  assert.equal(tidyPhone('k7q4 mz2p'), 'K7Q4-MZ2P');
  assert.equal(tidyPhone('K7Q4-MZ2'), null);
  const a = await phoneCode('device-a');
  assert.match(a, /^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  assert.equal(a, await phoneCode('device-a'));
  assert.notEqual(a, await phoneCode('device-b'));
});

test('days count from 1 Jan 2026', () => {
  assert.equal(dayNo('2026-01-01'), 0);
  assert.equal(dayNo('2027-01-01'), 365);
  for (const d of ['2026-02-28', '2026-12-31', '2030-06-15']) assert.equal(dayOf(dayNo(d)), d);
});

test('keys that are not signed by the owner are refused', async () => {
  const phone = await phoneCode('x');
  assert.deepEqual(await checkKey('SH-NOTAKEY', phone, '2026-10-20'), { ok: false, reason: 'bad' });
  const junk = `SH-${toB32(crypto.getRandomValues(new Uint8Array(69)))}`;
  assert.equal((await checkKey(junk, phone, '2026-10-20')).ok, false);
  assert.equal(await isOwnerCode('1234567'), false);
  assert.equal(await isOwnerCode('12345'), false);
  assert.equal(await signingKey('SHMK-not-the-master-key'), null);
});
