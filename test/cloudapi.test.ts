// The Firebase REST client against a pretend Google: signing in, refreshing the session,
// Firestore values both ways, only the changed fields of the family document, the owner's
// lists, and errors (offline, busy, signed out).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CloudError, FirebaseRest, MemoryCloud, fieldPath, fromFs, toFs, type Session } from '../src/platform/cloudapi.ts';

const cfg = { apiKey: 'KEY', projectId: 'mn-test', webClientId: 'web.apps.googleusercontent.com' };
type Call = { url: string; method: string; body?: string; auth?: string };

function fakeGoogle(handler: (c: Call) => { status?: number; json?: unknown } | 'offline') {
  const calls: Call[] = [];
  const http = (async (url: string, init?: RequestInit) => {
    const c: Call = { url: String(url), method: init?.method ?? 'GET', body: init?.body as string | undefined, auth: (init?.headers as Record<string, string> | undefined)?.Authorization };
    calls.push(c);
    const r = handler(c);
    if (r === 'offline') throw new TypeError('Failed to fetch');
    return new Response(JSON.stringify(r.json ?? {}), { status: r.status ?? 200 });
  }) as typeof fetch;
  return { calls, http };
}

const live = (exp = Date.now() + 3_600_000): Session => ({ uid: 'u1', email: 'a@b.com', name: 'A', idToken: 'tok1', refreshToken: 'ref1', exp });

test('values to and from Firestore', () => {
  const v = { n: 3, x: 1.5, s: 'hi', b: true, z: null, list: [1, 'a'], m: { k: 2 } };
  assert.deepEqual(fromFs(toFs(v)), v);
  assert.deepEqual(toFs(12), { integerValue: '12' });
});

test('sign in with the Google ID token: the session is kept, the email lower-cased', async () => {
  const g = fakeGoogle((c) => {
    assert.match(c.url, /accounts:signInWithIdp\?key=KEY$/);
    assert.match(JSON.parse(c.body!).postBody, /^id_token=GID&providerId=google\.com$/);
    return { json: { localId: 'u1', email: 'Asha@Example.com', displayName: 'Asha', idToken: 'T', refreshToken: 'R', expiresIn: '3600' } };
  });
  let kept: Session | null = null;
  const b = new FirebaseRest(cfg, null, (s) => (kept = s), g.http);
  const s = await b.signIn('GID');
  assert.equal(s.email, 'asha@example.com');
  assert.equal(kept!.uid, 'u1');
  // A refused sign-in.
  const bad = new FirebaseRest(cfg, null, () => undefined, fakeGoogle(() => ({ status: 400, json: { error: {} } })).http);
  await assert.rejects(bad.signIn('X'), (e: CloudError) => e.kind === 'denied');
});

test('an old session is refreshed first; a refused refresh signs out', async () => {
  const g = fakeGoogle((c) => {
    if (c.url.includes('securetoken')) return { json: { id_token: 'tok2', refresh_token: 'ref2', expires_in: '3600' } };
    assert.equal(c.auth, 'Bearer tok2');
    return { status: 404 };
  });
  let kept: Session | null = null;
  const b = new FirebaseRest(cfg, live(Date.now() - 1000), (s) => (kept = s), g.http);
  assert.equal(await b.getFamily(), null);
  assert.equal(kept!.idToken, 'tok2');
  const out = new FirebaseRest(cfg, live(Date.now() - 1000), (s) => (kept = s), fakeGoogle(() => ({ status: 400 })).http);
  await assert.rejects(out.getFamily(), (e: CloudError) => e.kind === 'signed-out');
  assert.equal(kept, null);
});

test('the family document: only the changed children, devices and removals are written', async () => {
  const g = fakeGoogle(() => ({ json: {} }));
  const b = new FirebaseRest(cfg, live(), () => undefined, g.http);
  const fam = { v: 1 as const, consentAt: 5, policy: 'p', kids: { c1: 10, c2: 20 }, removed: { c3: 30 }, resets: {}, devices: { dA: { label: 'Phone A', at: 40 } }, rules: { limitMinutes: 30 }, rulesAt: 7 };
  await b.putFamily(fam, { kids: ['c1'], removed: ['c3'], resets: [], device: 'dA' });
  const c = g.calls[0];
  assert.equal(c.method, 'PATCH');
  assert.match(c.url, /documents\/families\/u1\?/);
  const mask = new URL(c.url).searchParams.getAll('updateMask.fieldPaths');
  assert.deepEqual(mask.sort(), ['consentAt', 'deletedAt', 'devices.dA', 'kids.c1', 'kids.c3', 'policy', 'primary', 'removed.c3', 'rules', 'rulesAt', 'v'].sort());
  const body = JSON.parse(c.body!).fields;
  // The phone writing is the backup phone (one-phone backup without MN ×).
  assert.equal(fromFs(body.primary), 'dA');
  assert.deepEqual(fromFs(body.kids), { c1: 10 });
  assert.equal(fromFs(body.rules), JSON.stringify({ limitMinutes: 30 }));
});

test('the family document: phones taken off the list are in the mask with no value (so they are deleted)', async () => {
  const g = fakeGoogle(() => ({ json: {} }));
  const b = new FirebaseRest(cfg, live(), () => undefined, g.http);
  const fam = { v: 1 as const, consentAt: 5, policy: 'p', kids: {}, removed: {}, resets: {}, devices: { dA: { label: 'Phone A', at: 40 } }, rules: {}, rulesAt: 7 };
  // The phone writing is never taken off, even if it is named.
  await b.putFamily(fam, { kids: [], removed: [], resets: [], device: 'dA', gone: ['dOld1', 'dOld2', 'dA'] });
  const mask = new URL(g.calls[0].url).searchParams.getAll('updateMask.fieldPaths');
  assert.ok(mask.includes('devices.dOld1') && mask.includes('devices.dOld2') && mask.includes('devices.dA'));
  assert.deepEqual(fromFs(JSON.parse(g.calls[0].body!).fields.devices), { dA: { label: 'Phone A', at: 40 } });
});

test('field paths: plain names as they are, anything else in backticks', () => {
  assert.equal(fieldPath('kids', 'c1ab'), 'kids.c1ab');
  assert.equal(fieldPath('kids', 'kid-A'), 'kids.`kid-A`');
  assert.equal(fieldPath('kids', '7up'), 'kids.`7up`');
  assert.equal(fieldPath('a', 'b`c\\d'), 'a.`b\\`c\\\\d`');
});

test('the stand-in cloud takes phones off the list the same way', async () => {
  const m = new Map<string, string>();
  const mc = new MemoryCloud({ get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) }, null, () => undefined);
  await mc.signIn('a@b.com|A');
  const fam = { v: 1 as const, consentAt: 5, policy: 'p', kids: {}, removed: {}, resets: {}, devices: { dA: { label: 'A', at: 1 } }, rules: {}, rulesAt: 1 };
  await mc.putFamily(fam, { kids: [], removed: [], resets: [], device: 'dA' });
  await mc.putFamily({ ...fam, devices: { dB: { label: 'B', at: 2 } } }, { kids: [], removed: [], resets: [], device: 'dB' });
  assert.deepEqual(Object.keys((await mc.getFamily())!.devices).sort(), ['dA', 'dB']);
  await mc.putFamily({ ...fam, devices: { dB: { label: 'B', at: 3 } } }, { kids: [], removed: [], resets: [], device: 'dB', gone: ['dA'] });
  assert.deepEqual(Object.keys((await mc.getFamily())!.devices), ['dB']);
});

test('a child copy goes up as bytes and comes back the same', async () => {
  let stored: unknown;
  const g = fakeGoogle((c) => {
    if (c.method === 'PATCH') {
      stored = JSON.parse(c.body!);
      return { json: stored };
    }
    return { json: stored };
  });
  const b = new FirebaseRest(cfg, live(), () => undefined, g.http);
  await b.putChild({ childId: 'c1', updatedAt: 123, device: 'dA', data: 'AAEC' });
  assert.deepEqual((stored as { fields: { data: unknown } }).fields.data, { bytesValue: 'AAEC' });
  assert.deepEqual(await b.getChild('c1'), { childId: 'c1', updatedAt: 123, device: 'dA', data: 'AAEC' });
});

test('asking for MN ×: the request goes to requests/{uid} with only the fields the rules allow, is read back, and is tidied away', async () => {
  let stored: { fields: Record<string, unknown> } | null = null;
  const g = fakeGoogle((c) => {
    assert.match(c.url, /documents\/requests\/u1(\?|$)/);
    if (c.method === 'PATCH') {
      stored = JSON.parse(c.body!);
      return { json: stored };
    }
    if (c.method === 'DELETE') {
      stored = null;
      return { json: {} };
    }
    return stored ? { json: stored } : { status: 404 };
  });
  const b = new FirebaseRest(cfg, live(), () => undefined, g.http);
  assert.equal(await b.myRequest(), null);
  await b.requestAccess({ phone: 'AAAA-BBBB', device: 'Phone AAAA-BBBB', version: 'v1', at: 1234 });
  assert.deepEqual(Object.keys(stored!.fields).sort(), ['at', 'device', 'email', 'name', 'phone', 'version']);
  assert.equal(fromFs(stored!.fields.email as never), 'a@b.com');
  assert.deepEqual(await b.myRequest(), { at: 1234 });
  await b.dropMyRequest();
  assert.equal(g.calls.at(-1)!.method, 'DELETE');
  assert.equal(await b.myRequest(), null);
});

test('owner lists, approval, and errors', async () => {
  const g = fakeGoogle((c) => {
    if (c.url.includes('/requests?')) return { json: { documents: [{ name: 'projects/x/databases/(default)/documents/requests/u9', fields: toFs({ email: 'z@y.com', name: 'Zed', phone: 'AAAA-BBBB', device: 'Phone AAAA-BBBB', version: 'v1', at: 9 }).mapValue.fields } ] } };
    return { json: {} };
  });
  const b = new FirebaseRest(cfg, { ...live(), email: 'moulik1111a@gmail.com' }, () => undefined, g.http);
  assert.deepEqual(await b.listRequests(), [{ uid: 'u9', email: 'z@y.com', name: 'Zed', phone: 'AAAA-BBBB', device: 'Phone AAAA-BBBB', version: 'v1', at: 9 }]);
  assert.equal((await b.myAccess())!.until, 0); // the owner is always approved
  await b.approve({ email: 'Z@Y.com', name: 'Zed', until: 0, addedAt: 1 });
  assert.match(g.calls.at(-1)!.url, /documents\/access\/z%40y\.com$/);
  const off = new FirebaseRest(cfg, live(), () => undefined, fakeGoogle(() => 'offline').http);
  await assert.rejects(off.getFamily(), (e: CloudError) => e.kind === 'offline');
  const busy = new FirebaseRest(cfg, live(), () => undefined, fakeGoogle(() => ({ status: 429 })).http);
  await assert.rejects(busy.getFamily(), (e: CloudError) => e.kind === 'quota');
});
