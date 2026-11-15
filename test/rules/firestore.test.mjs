// The cloud rules (firestore.rules) against the Firestore emulator (review fix 9).
// Run by .github/workflows/rules.yml:
//   firebase emulators:exec --only firestore --project demo-mn "node --test test/rules/"
// RULES_FILE picks another rules file (the workflow also tries the rules live now, for comparison).
import { after, before, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Bytes, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

const OWNER = 'owner-uid';
let env;

before(async () => {
  const rules = readFileSync(process.env.RULES_FILE || 'firestore.rules', 'utf8').replaceAll('__OWNER_UID__', OWNER);
  env = await initializeTestEnvironment({ projectId: 'demo-mn', firestore: { rules } });
});
after(async () => env?.cleanup());
beforeEach(async () => env.clearFirestore());

/** A signed-in grown-up (a verified Google address unless said otherwise). */
const as = (uid, email = `${uid}@example.com`, verified = true) => env.authenticatedContext(uid, { email, email_verified: verified }).firestore();
const nobody = () => env.unauthenticatedContext().firestore();
/** Put something in place without the rules (as an earlier write would have). */
const seed = (path, data) => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), path), data));

const family = (extra = {}) => ({
  v: 1,
  policy: '2026-11-15',
  consentAt: 1763164800000,
  kids: { kidA: 1763164800000 },
  removed: {},
  resets: {},
  devices: { dK7Q4MZ2P: { label: 'Phone K7Q4-MZ2P', at: 1763164800000 } },
  rules: '{"limit":30}',
  rulesAt: 1763164800000,
  primary: 'dK7Q4MZ2P',
  ...extra,
});
const child = (id, size = 2000, extra = {}) => ({ v: 1, childId: id, updatedAt: 1763164800000, device: 'dK7Q4MZ2P', data: Bytes.fromUint8Array(new Uint8Array(size)), ...extra });

// ── a family's own online backup ─────────────────────────────────────────────

test('a grown-up writes and reads their own family and children', async () => {
  const db = as('alice');
  await assertSucceeds(setDoc(doc(db, 'families/alice'), family()));
  await assertSucceeds(getDoc(doc(db, 'families/alice')));
  await assertSucceeds(updateDoc(doc(db, 'families/alice'), { 'kids.kidB': 1763164900000, 'devices.dOTHER': { label: 'Phone AAAA-BBBB', at: 1 } }));
  await assertSucceeds(setDoc(doc(db, 'families/alice/children/kidA'), child('kidA')));
  await assertSucceeds(getDoc(doc(db, 'families/alice/children/kidA')));
  await assertSucceeds(getDocs(collection(db, 'families/alice/children')));
  await assertSucceeds(deleteDoc(doc(db, 'families/alice/children/kidA')));
  // "Delete the online backup" leaves only a note; then the account goes.
  await assertSucceeds(setDoc(doc(db, 'families/alice'), { v: 1, deletedAt: 1763165000000 }));
  await assertSucceeds(deleteDoc(doc(db, 'families/alice')));
});

test('another account is refused, whatever it tries', async () => {
  await seed('families/bob', family());
  await seed('families/bob/children/kidA', child('kidA'));
  const db = as('alice');
  await assertFails(getDoc(doc(db, 'families/bob')));
  await assertFails(setDoc(doc(db, 'families/bob'), family()));
  await assertFails(updateDoc(doc(db, 'families/bob'), { 'kids.x': 1 }));
  await assertFails(deleteDoc(doc(db, 'families/bob')));
  await assertFails(getDoc(doc(db, 'families/bob/children/kidA')));
  await assertFails(getDocs(collection(db, 'families/bob/children')));
  await assertFails(setDoc(doc(db, 'families/bob/children/kidA'), child('kidA')));
  await assertFails(deleteDoc(doc(db, 'families/bob/children/kidA')));
  await assertFails(getDocs(collection(db, 'families')));
});

test('no sign-in, or an unverified address, is refused', async () => {
  await seed('families/alice', family());
  await assertFails(getDoc(doc(nobody(), 'families/alice')));
  await assertFails(setDoc(doc(nobody(), 'families/alice'), family()));
  const unverified = as('alice', 'alice@example.com', false);
  await assertFails(getDoc(doc(unverified, 'families/alice')));
  await assertFails(setDoc(doc(unverified, 'families/alice/children/kidA'), child('kidA')));
});

test('a family document must have the app’s shape', async () => {
  const db = as('alice');
  const bad = {
    'an unknown field': family({ admin: true }),
    'another version': family({ v: 2 }),
    '21 children': family({ kids: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, 1])) }),
    'family rules over 20 KB': family({ rules: 'x'.repeat(20001) }),
    'family rules that are not text': family({ rules: { limit: 30 } }),
    '21 phones': family({ devices: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`d${i}`, { label: 'x', at: 1 }])) }),
    'a time that is text': family({ consentAt: 'now' }),
    'a note with more in it': { v: 1, deletedAt: 1, kids: {} },
  };
  for (const [what, d] of Object.entries(bad)) await assertFails(setDoc(doc(db, 'families/alice'), d)).catch((e) => Promise.reject(new Error(`${what}: ${e.message}`)));
  await assertSucceeds(setDoc(doc(db, 'families/alice'), family({ kids: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, 1])), rules: 'x'.repeat(20000) })));
});

test('a child document must have the app’s shape, its id and a backup under 900 KB', async () => {
  const db = as('alice');
  const bad = {
    'childId not the document id': ['kidA', child('kidB')],
    'a child id outside the pattern': ['kid.A', child('kid.A')],
    'a 41-character id': ['k'.repeat(41), child('k'.repeat(41))],
    'an unknown field': ['kidA', child('kidA', 10, { extra: 1 })],
    'the backup as text': ['kidA', child('kidA', 10, { data: 'H4sIAAAA' })],
    'a backup of 900 KB': ['kidA', child('kidA', 900000)],
    'a long device id': ['kidA', child('kidA', 10, { device: 'd'.repeat(65) })],
    'another version': ['kidA', child('kidA', 10, { v: 2 })],
  };
  for (const [what, [id, d]] of Object.entries(bad)) await assertFails(setDoc(doc(db, `families/alice/children/${id}`), d)).catch((e) => Promise.reject(new Error(`${what}: ${e.message}`)));
  await assertSucceeds(setDoc(doc(db, 'families/alice/children/kid_A-1'), child('kid_A-1', 899999)));
});

// ── the shared APK's approvals: the owner is an account id, not an address ─

test('the owner (by account id) sees and manages approvals', async () => {
  await seed('requests/alice', { email: 'alice@example.com', name: 'Alice', phone: 'K7Q4-MZ2P', device: 'Phone K7Q4-MZ2P', version: '1.0', at: 1 });
  await seed('checkins/alice', { email: 'alice@example.com', name: 'Alice', devices: {} });
  const db = as(OWNER, 'owner@example.com');
  await assertSucceeds(getDocs(collection(db, 'requests')));
  await assertSucceeds(getDocs(collection(db, 'checkins')));
  await assertSucceeds(getDocs(collection(db, 'access')));
  await assertSucceeds(setDoc(doc(db, 'access/alice@example.com'), { email: 'alice@example.com', name: 'Alice', until: 0, addedAt: 1 }));
  await assertSucceeds(setDoc(doc(db, 'owner/keys'), { list: '[]', at: 1 }));
  await assertSucceeds(deleteDoc(doc(db, 'requests/alice')));
  // The owner's own family is just a family: no one else's.
  await seed('families/alice', family());
  await assertFails(getDoc(doc(db, 'families/alice')));
});

test('the owner’s address on another account opens nothing', async () => {
  const impostor = as('mallory', 'owner@example.com');
  await assertFails(getDocs(collection(impostor, 'requests')));
  await assertFails(getDocs(collection(impostor, 'access')));
  await assertFails(setDoc(doc(impostor, 'access/mallory@example.com'), { email: 'mallory@example.com', name: 'M', until: 0, addedAt: 1 }));
  await assertFails(getDoc(doc(impostor, 'owner/keys')));
  await assertFails(setDoc(doc(impostor, 'owner/keys'), { list: '[]', at: 1 }));
});

test('a grown-up asks for access, checks in, and reads only their own approval', async () => {
  await seed('access/alice@example.com', { email: 'alice@example.com', name: 'Alice', until: 0, addedAt: 1 });
  await seed('access/bob@example.com', { email: 'bob@example.com', name: 'Bob', until: 0, addedAt: 1 });
  const db = as('alice');
  await assertSucceeds(getDoc(doc(db, 'access/alice@example.com')));
  await assertFails(getDoc(doc(db, 'access/bob@example.com')));
  await assertFails(getDocs(collection(db, 'access')));
  await assertFails(setDoc(doc(db, 'access/alice@example.com'), { email: 'alice@example.com', name: 'Alice', until: 0, addedAt: 1 }));
  await assertSucceeds(setDoc(doc(db, 'requests/alice'), { email: 'alice@example.com', name: 'Alice', phone: 'K7Q4-MZ2P', device: 'Phone K7Q4-MZ2P', version: '1.0', at: 1 }));
  await assertSucceeds(getDoc(doc(db, 'requests/alice')));
  await assertFails(setDoc(doc(db, 'requests/alice'), { email: 'bob@example.com', name: 'Alice', at: 1 }), 'someone else’s address');
  await assertFails(setDoc(doc(db, 'requests/alice'), { email: 'alice@example.com', at: 1, approved: true }), 'an unknown field');
  await assertFails(setDoc(doc(db, 'requests/bob'), { email: 'alice@example.com', at: 1 }), 'another account’s request');
  await assertFails(getDocs(collection(db, 'requests')));
  await assertSucceeds(setDoc(doc(db, 'checkins/alice'), { email: 'alice@example.com', name: 'Alice', devices: { dK7Q4MZ2P: { phone: 'K7Q4-MZ2P', label: 'Phone K7Q4-MZ2P', version: '1.0', at: 1 } } }));
  await assertFails(getDocs(collection(db, 'checkins')));
  await assertFails(getDoc(doc(db, 'owner/keys')));
});

test('everything else is closed', async () => {
  await assertFails(setDoc(doc(as('alice'), 'anything/else'), { a: 1 }));
  await assertFails(getDoc(doc(as(OWNER, 'owner@example.com'), 'anything/else')));
  await assertFails(setDoc(doc(nobody(), 'requests/x'), { email: 'x@example.com', at: 1 }));
});
