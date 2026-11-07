// Talking to Google: Firebase Auth (sign in with the Google ID token from the phone, keep the
// session fresh) and Firestore (the family document and one document per child), over their
// REST interfaces, so no Firebase library is bundled. A memory stand-in with the same shape
// runs in tests and debug builds (`?debug&cloudmock`).

import type { CloudChild, FamilyDoc } from '../core/cloud.ts';

export interface FirebaseConfig {
  apiKey: string;
  projectId: string;
  /** The OAuth "Web client" ID (Firebase → Authentication → Google → Web SDK configuration). */
  webClientId: string;
}

export interface Session {
  uid: string;
  email: string;
  name: string;
  idToken: string;
  refreshToken: string;
  /** When idToken stops working (ms). */
  exp: number;
}

export type CloudErrorKind = 'offline' | 'signed-out' | 'quota' | 'denied' | 'other';
/** The account that approves people (also written into firestore.rules). */
export const OWNER_EMAIL = 'moulik1111a@gmail.com';

export class CloudError extends Error {
  readonly kind: CloudErrorKind;
  constructor(kind: CloudErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

/** An approved Google account (only the owner writes these). `until` 0 = no end date. */
export interface AccessEntry {
  email: string;
  name: string;
  until: number;
  addedAt: number;
}
/** Someone who signed in but isn't approved yet. */
export interface AccessRequest {
  uid: string;
  email: string;
  name: string;
  phone: string;
  device: string;
  version: string;
  at: number;
}
/** The phones an account has used. `via` is how that phone got in. */
export interface CheckIn {
  uid: string;
  email: string;
  name: string;
  devices: Record<string, { phone: string; label: string; version: string; at: number }>;
}

export interface FamilyChanges {
  kids: string[];
  removed: string[];
  resets: string[];
  device: string;
}

/** A phone-code key the owner made (as listed in the owner area; the master key never leaves the device). */
export interface OwnerKey {
  id: string;
  name: string;
  phone: string;
  /** Last day it works (a day number, core/access.ts). */
  until: number;
  key: string;
  made: string;
}

/** What the app needs from the cloud. */
export interface CloudBackend {
  /** This account's approval (null: not approved). */
  myAccess(): Promise<AccessEntry | null>;
  requestAccess(r: Omit<AccessRequest, 'uid' | 'email' | 'name'>): Promise<void>;
  checkIn(deviceId: string, d: CheckIn['devices'][string]): Promise<void>;
  // The owner's tools.
  listAccess(): Promise<AccessEntry[]>;
  listRequests(): Promise<AccessRequest[]>;
  listCheckins(): Promise<CheckIn[]>;
  approve(e: AccessEntry): Promise<void>;
  removeAccess(email: string): Promise<void>;
  dropRequest(uid: string): Promise<void>;
  /** The owner's list of phone-code keys made (never the master key itself). */
  ownerKeys(): Promise<OwnerKey[] | null>;
  saveOwnerKeys(list: OwnerKey[]): Promise<void>;

  signIn(googleIdToken: string): Promise<Session>;
  getFamily(): Promise<FamilyDoc | null>;
  getChild(id: string): Promise<CloudChild | null>;
  putChild(doc: CloudChild): Promise<void>;
  deleteChild(id: string): Promise<void>;
  /** Write the family document: only the given children, devices, removals and replacements change. */
  putFamily(f: FamilyDoc, ch: FamilyChanges): Promise<void>;
  /** Delete everything this family has in the cloud. */
  deleteAll(): Promise<void>;
  /** Delete everything, then the MN sign-in account itself. */
  deleteAccount(): Promise<void>;
  session: Session | null;
}

type Fetch = typeof fetch;

// ── Firestore values ────────────────────────────────────────────────────────

type FsValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { bytesValue: string }
  | { mapValue: { fields?: Record<string, FsValue> } }
  | { arrayValue: { values?: FsValue[] } };

export function toFs(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v as object).filter(([, x]) => x !== undefined).map(([k, x]) => [k, toFs(x)])) } };
}

export function fromFs(v: FsValue): unknown {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('bytesValue' in v) return v.bytesValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(fromFs);
  return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, fromFs(x)]));
}

const fields = (o: Record<string, unknown>) => (toFs(o) as { mapValue: { fields: Record<string, FsValue> } }).mapValue.fields;
const unfields = (f: Record<string, FsValue> | undefined) => fromFs({ mapValue: { fields: f ?? {} } }) as Record<string, unknown>;

const toEntry = (email: string, f: Record<string, unknown>): AccessEntry => ({ email, name: String(f.name ?? ''), until: Number(f.until ?? 0), addedAt: Number(f.addedAt ?? 0) });

// ── the real thing ──────────────────────────────────────────────────────────

const SESSION_SLACK = 5 * 60_000;

export class FirebaseRest implements CloudBackend {
  session: Session | null;
  private readonly cfg: FirebaseConfig;
  private readonly onSession: (s: Session | null) => void;
  private readonly http: Fetch;
  constructor(cfg: FirebaseConfig, session: Session | null, onSession: (s: Session | null) => void, http: Fetch = (...a) => fetch(...a)) {
    this.cfg = cfg;
    this.session = session;
    this.onSession = onSession;
    this.http = http;
  }

  private async call(url: string, init: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await this.http(url, init);
    } catch {
      throw new CloudError('offline', 'No internet connection.');
    }
    return res;
  }

  async signIn(googleIdToken: string): Promise<Session> {
    const res = await this.call(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${this.cfg.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postBody: `id_token=${encodeURIComponent(googleIdToken)}&providerId=google.com`, requestUri: 'http://localhost', returnSecureToken: true, returnIdpCredential: false }),
    });
    const j = (await res.json().catch(() => ({}))) as Record<string, string>;
    if (!res.ok || !j.idToken) throw new CloudError('denied', 'Google sign-in didn’t work. Please try again.');
    const s: Session = { uid: j.localId, email: (j.email ?? '').toLowerCase(), name: j.displayName ?? j.fullName ?? '', idToken: j.idToken, refreshToken: j.refreshToken, exp: Date.now() + Number(j.expiresIn ?? 3600) * 1000 };
    this.session = s;
    this.onSession(s);
    return s;
  }

  private async token(force = false): Promise<string> {
    const s = this.session;
    if (!s) throw new CloudError('signed-out', 'Not signed in.');
    if (!force && Date.now() < s.exp - SESSION_SLACK) return s.idToken;
    const res = await this.call(`https://securetoken.googleapis.com/v1/token?key=${this.cfg.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(s.refreshToken)}`,
    });
    const j = (await res.json().catch(() => ({}))) as Record<string, string>;
    if (!res.ok || !j.id_token) {
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        this.session = null;
        this.onSession(null);
        throw new CloudError('signed-out', 'Please sign in again.');
      }
      throw new CloudError('other', 'Couldn’t reach Google just now.');
    }
    const fresh: Session = { ...s, idToken: j.id_token, refreshToken: j.refresh_token ?? s.refreshToken, exp: Date.now() + Number(j.expires_in ?? 3600) * 1000 };
    this.session = fresh;
    this.onSession(fresh);
    return fresh.idToken;
  }

  private docUrl(path: string, query = ''): string {
    return `https://firestore.googleapis.com/v1/projects/${this.cfg.projectId}/databases/(default)/documents/${path}${query}`;
  }
  private get family(): string {
    if (!this.session) throw new CloudError('signed-out', 'Not signed in.');
    return `families/${this.session.uid}`;
  }

  /** A Firestore call with the session, refreshed once if it has run out. */
  private async fs(method: string, path: string, query = '', body?: unknown): Promise<Response> {
    const go = async (force: boolean) =>
      this.call(this.docUrl(path, query), { method, headers: { Authorization: `Bearer ${await this.token(force)}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let res = await go(false);
    if (res.status === 401) res = await go(true);
    if (res.status === 429 || res.status === 503) throw new CloudError('quota', 'The cloud is busy. MN will try again later.');
    if (res.status === 403) throw new CloudError('denied', 'The cloud refused this. Please sign in again.');
    return res;
  }

  private async list(coll: string): Promise<{ id: string; f: Record<string, unknown> }[]> {
    const out: { id: string; f: Record<string, unknown> }[] = [];
    let page = '';
    for (let n = 0; n < 20; n++) {
      const res = await this.fs('GET', coll, `?pageSize=300${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`);
      if (!res.ok) throw new CloudError('other', `Cloud error ${res.status}`);
      const j = (await res.json()) as { documents?: { name: string; fields?: Record<string, FsValue> }[]; nextPageToken?: string };
      for (const d of j.documents ?? []) out.push({ id: decodeURIComponent(d.name.split('/').pop()!), f: unfields(d.fields) });
      if (!j.nextPageToken) break;
      page = j.nextPageToken;
    }
    return out;
  }
  private async patch(path: string, data: Record<string, unknown>, mask?: string[]): Promise<void> {
    const q = mask ? `?${mask.map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join('&')}` : '';
    const res = await this.fs('PATCH', path, q, { fields: fields(data) });
    if (!res.ok) throw new CloudError(res.status === 403 ? 'denied' : 'other', `Cloud error ${res.status}`);
  }
  private async remove(path: string): Promise<void> {
    const res = await this.fs('DELETE', path);
    if (!res.ok && res.status !== 404) throw new CloudError('other', `Cloud error ${res.status}`);
  }
  private get me(): Session {
    if (!this.session) throw new CloudError('signed-out', 'Not signed in.');
    return this.session;
  }

  async myAccess(): Promise<AccessEntry | null> {
    if (this.me.email === OWNER_EMAIL) return { email: this.me.email, name: this.me.name, until: 0, addedAt: 0 };
    const res = await this.fs('GET', `access/${encodeURIComponent(this.me.email)}`).catch((e: CloudError) => {
      if (e.kind === 'denied') return null;
      throw e;
    });
    if (!res || res.status === 404) return null;
    if (!res.ok) throw new CloudError('other', `Cloud error ${res.status}`);
    return toEntry(this.me.email, unfields(((await res.json()) as { fields?: Record<string, FsValue> }).fields));
  }
  async requestAccess(r: Omit<AccessRequest, 'uid' | 'email' | 'name'>): Promise<void> {
    await this.patch(`requests/${this.me.uid}`, { email: this.me.email, name: this.me.name, phone: r.phone, device: r.device, version: r.version, at: r.at });
  }
  async checkIn(deviceId: string, d: CheckIn['devices'][string]): Promise<void> {
    await this.patch(`checkins/${this.me.uid}`, { email: this.me.email, name: this.me.name, devices: { [deviceId]: d } }, ['email', 'name', `devices.${deviceId}`]);
  }
  async listAccess(): Promise<AccessEntry[]> {
    return (await this.list('access')).map((d) => toEntry(d.id, d.f));
  }
  async listRequests(): Promise<AccessRequest[]> {
    return (await this.list('requests')).map((d) => ({ uid: d.id, email: String(d.f.email ?? ''), name: String(d.f.name ?? ''), phone: String(d.f.phone ?? ''), device: String(d.f.device ?? ''), version: String(d.f.version ?? ''), at: Number(d.f.at ?? 0) }));
  }
  async listCheckins(): Promise<CheckIn[]> {
    return (await this.list('checkins')).map((d) => ({ uid: d.id, email: String(d.f.email ?? ''), name: String(d.f.name ?? ''), devices: (d.f.devices ?? {}) as CheckIn['devices'] }));
  }
  async approve(e: AccessEntry): Promise<void> {
    await this.patch(`access/${encodeURIComponent(e.email.toLowerCase())}`, { email: e.email.toLowerCase(), name: e.name, until: e.until, addedAt: e.addedAt });
  }
  async removeAccess(email: string): Promise<void> {
    await this.remove(`access/${encodeURIComponent(email.toLowerCase())}`);
  }
  async dropRequest(uid: string): Promise<void> {
    await this.remove(`requests/${uid}`);
  }
  async ownerKeys(): Promise<OwnerKey[] | null> {
    const res = await this.fs('GET', 'owner/keys');
    if (res.status === 404) return null;
    if (!res.ok) throw new CloudError('other', `Cloud error ${res.status}`);
    const f = unfields(((await res.json()) as { fields?: Record<string, FsValue> }).fields);
    try {
      return JSON.parse(String(f.list ?? '[]')) as OwnerKey[];
    } catch {
      return [];
    }
  }
  async saveOwnerKeys(list: OwnerKey[]): Promise<void> {
    await this.patch('owner/keys', { list: JSON.stringify(list), at: Date.now() });
  }

  async getFamily(): Promise<FamilyDoc | null> {
    const res = await this.fs('GET', this.family);
    if (res.status === 404) return null;
    if (!res.ok) throw new CloudError('other', `Cloud error ${res.status}`);
    const f = unfields(((await res.json()) as { fields?: Record<string, FsValue> }).fields);
    return { v: 1, consentAt: Number(f.consentAt ?? 0), policy: String(f.policy ?? ''), kids: (f.kids ?? {}) as Record<string, number>, removed: (f.removed ?? {}) as Record<string, number>, resets: (f.resets ?? {}) as Record<string, number>, deletedAt: f.deletedAt ? Number(f.deletedAt) : undefined, devices: (f.devices ?? {}) as FamilyDoc['devices'], rules: f.rules ? JSON.parse(String(f.rules)) : {}, rulesAt: Number(f.rulesAt ?? 0), primary: f.primary ? String(f.primary) : undefined };
  }

  async putFamily(f: FamilyDoc, ch: FamilyChanges): Promise<void> {
    const { kids, removed, resets, device } = ch;
    // Only these fields change, so two phones syncing at once don't undo each other.
    const paths = ['v', 'policy', 'consentAt', 'rules', 'rulesAt', 'deletedAt', 'primary', `devices.${device}`, ...kids.map((id) => `kids.${id}`), ...removed.flatMap((id) => [`removed.${id}`, `kids.${id}`]), ...resets.map((id) => `resets.${id}`)];
    const body = { fields: fields({ v: 1, policy: f.policy, consentAt: f.consentAt, rules: JSON.stringify(f.rules), rulesAt: f.rulesAt, primary: f.primary ?? device, devices: { [device]: f.devices[device] }, kids: Object.fromEntries(kids.filter((id) => f.kids[id] !== undefined).map((id) => [id, f.kids[id]])), removed: Object.fromEntries(removed.map((id) => [id, f.removed[id]])), resets: Object.fromEntries(resets.map((id) => [id, f.resets[id]])) }) };
    const q = `?${[...new Set(paths)].map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join('&')}`;
    const res = await this.fs('PATCH', this.family, q, body);
    if (!res.ok) throw new CloudError('other', `Cloud error ${res.status}`);
  }

  async getChild(id: string): Promise<CloudChild | null> {
    const res = await this.fs('GET', `${this.family}/children/${id}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new CloudError('other', `Cloud error ${res.status}`);
    const f = unfields(((await res.json()) as { fields?: Record<string, FsValue> }).fields);
    return { childId: String(f.childId), updatedAt: Number(f.updatedAt), device: String(f.device ?? ''), data: String(f.data) };
  }

  async putChild(doc: CloudChild): Promise<void> {
    const body = { fields: { v: { integerValue: '1' }, childId: { stringValue: doc.childId }, updatedAt: { integerValue: String(doc.updatedAt) }, device: { stringValue: doc.device }, data: { bytesValue: doc.data } } };
    const res = await this.fs('PATCH', `${this.family}/children/${doc.childId}`, '', body);
    if (!res.ok) throw new CloudError('other', `Cloud error ${res.status}`);
  }

  async deleteChild(id: string): Promise<void> {
    const res = await this.fs('DELETE', `${this.family}/children/${id}`);
    if (!res.ok && res.status !== 404) throw new CloudError('other', `Cloud error ${res.status}`);
  }

  async deleteAll(): Promise<void> {
    const res = await this.fs('GET', `${this.family}/children`, '?pageSize=300&mask.fieldPaths=childId');
    if (res.ok) {
      const j = (await res.json()) as { documents?: { name: string }[] };
      for (const d of j.documents ?? []) await this.deleteChild(d.name.split('/').pop()!);
    }
    // Leave only a note that it was deleted, so other phones stop syncing instead of uploading again.
    const r2 = await this.fs('PATCH', this.family, '', { fields: fields({ v: 1, deletedAt: Date.now() }) });
    if (!r2.ok) throw new CloudError('other', `Cloud error ${r2.status}`);
  }
  /** Delete the account: every child, the family document, the approval request and phone
   *  check-ins (no note left behind, since no phone can sign in to it again), then the sign-in. */
  async deleteAccount(): Promise<void> {
    const uid = this.me.uid;
    const res = await this.fs('GET', `${this.family}/children`, '?pageSize=300&mask.fieldPaths=childId');
    if (res.ok) {
      const j = (await res.json()) as { documents?: { name: string }[] };
      for (const d of j.documents ?? []) await this.deleteChild(d.name.split('/').pop()!);
    } else if (res.status !== 404) throw new CloudError('other', `Cloud error ${res.status}`);
    await this.remove(this.family);
    for (const p of [`requests/${uid}`, `checkins/${uid}`]) await this.remove(p).catch(() => {});
    const idToken = await this.token(true);
    const r = await this.call(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${this.cfg.apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!r.ok) throw new CloudError('other', `Account error ${r.status}`);
  }

}

// ── the stand-in (tests, debug builds) ──────────────────────────────────────

/** Keeps the "cloud" in a storage slot, so a reload (or a second tab) acts like another phone. */
export class MemoryCloud implements CloudBackend {
  session: Session | null;
  private readonly store: { get(k: string): string | null; set(k: string, v: string): void };
  private readonly onSession: (s: Session | null) => void;
  constructor(store: { get(k: string): string | null; set(k: string, v: string): void }, session: Session | null, onSession: (s: Session | null) => void) {
    this.store = store;
    this.session = session;
    this.onSession = onSession;
  }
  private read(): { family: FamilyDoc | null; kids: Record<string, CloudChild> } {
    try {
      return JSON.parse(this.store.get(`studyhard.mockcloud.family.${this.me.uid}`) ?? '') as never;
    } catch {
      return { family: null, kids: {} };
    }
  }
  private write(d: { family: FamilyDoc | null; kids: Record<string, CloudChild> }) {
    this.store.set(`studyhard.mockcloud.family.${this.me.uid}`, JSON.stringify(d));
  }
  async signIn(googleIdToken: string): Promise<Session> {
    const [email, name] = googleIdToken.split('|');
    const e = (email || 'parent@example.com').toLowerCase();
    const s: Session = { uid: `mock-${e}`, email: e, name: name || 'Parent', idToken: 'mock', refreshToken: 'mock', exp: Date.now() + 3_600_000 };
    this.session = s;
    this.onSession(s);
    return s;
  }
  private bag<T>(k: string): Record<string, T> {
    try {
      return JSON.parse(this.store.get(`studyhard.mockcloud.${k}`) ?? '{}') as Record<string, T>;
    } catch {
      return {};
    }
  }
  private setBag(k: string, v: unknown) {
    this.store.set(`studyhard.mockcloud.${k}`, JSON.stringify(v));
  }
  private get me(): Session {
    if (!this.session) throw new CloudError('signed-out', 'Not signed in.');
    return this.session;
  }
  private get owner(): boolean {
    return this.me.email === OWNER_EMAIL;
  }
  private ownerOnly() {
    if (!this.owner) throw new CloudError('denied', 'Only the owner can do that.');
  }
  async myAccess() {
    if (this.owner) return { email: this.me.email, name: this.me.name, until: 0, addedAt: 0 };
    return this.bag<AccessEntry>('access')[this.me.email] ?? null;
  }
  async requestAccess(r: Omit<AccessRequest, 'uid' | 'email' | 'name'>) {
    const b = this.bag<AccessRequest>('requests');
    b[this.me.uid] = { ...r, uid: this.me.uid, email: this.me.email, name: this.me.name };
    this.setBag('requests', b);
  }
  async checkIn(deviceId: string, d: CheckIn['devices'][string]) {
    const b = this.bag<CheckIn>('checkins');
    const c = b[this.me.uid] ?? { uid: this.me.uid, email: this.me.email, name: this.me.name, devices: {} };
    c.devices[deviceId] = d;
    b[this.me.uid] = c;
    this.setBag('checkins', b);
  }
  async listAccess() {
    this.ownerOnly();
    return Object.values(this.bag<AccessEntry>('access'));
  }
  async listRequests() {
    this.ownerOnly();
    return Object.values(this.bag<AccessRequest>('requests'));
  }
  async listCheckins() {
    this.ownerOnly();
    return Object.values(this.bag<CheckIn>('checkins'));
  }
  async approve(e: AccessEntry) {
    this.ownerOnly();
    const b = this.bag<AccessEntry>('access');
    b[e.email.toLowerCase()] = { ...e, email: e.email.toLowerCase() };
    this.setBag('access', b);
  }
  async removeAccess(email: string) {
    this.ownerOnly();
    const b = this.bag<AccessEntry>('access');
    delete b[email.toLowerCase()];
    this.setBag('access', b);
  }
  async dropRequest(uid: string) {
    this.ownerOnly();
    const b = this.bag<AccessRequest>('requests');
    delete b[uid];
    this.setBag('requests', b);
  }
  async ownerKeys() {
    this.ownerOnly();
    const v = this.store.get('studyhard.mockcloud.ownerkeys');
    return v ? (JSON.parse(v) as OwnerKey[]) : null;
  }
  async saveOwnerKeys(list: OwnerKey[]) {
    this.ownerOnly();
    this.store.set('studyhard.mockcloud.ownerkeys', JSON.stringify(list));
  }
  async getFamily() {
    return this.read().family;
  }
  async getChild(id: string) {
    return this.read().kids[id] ?? null;
  }
  async putChild(doc: CloudChild) {
    const d = this.read();
    d.kids[doc.childId] = doc;
    this.write(d);
  }
  async deleteChild(id: string) {
    const d = this.read();
    delete d.kids[id];
    this.write(d);
  }
  async putFamily(f: FamilyDoc, ch: FamilyChanges) {
    const { kids, removed, resets, device } = ch;
    const d = this.read();
    const old = d.family;
    const merged: FamilyDoc = old && !old.deletedAt ? { ...old, v: 1, policy: f.policy, consentAt: f.consentAt, rules: f.rules, rulesAt: f.rulesAt, kids: { ...old.kids }, removed: { ...old.removed }, resets: { ...(old.resets ?? {}) }, devices: { ...old.devices } } : { ...f, kids: {}, removed: {}, resets: {}, devices: {} };
    for (const id of resets) merged.resets[id] = f.resets[id];
    merged.devices[device] = f.devices[device];
    merged.primary = f.primary ?? device;
    for (const id of kids) if (f.kids[id] !== undefined) merged.kids[id] = f.kids[id];
    for (const id of removed) {
      merged.removed[id] = f.removed[id];
      delete merged.kids[id];
    }
    d.family = merged;
    this.write(d);
  }
  async deleteAll() {
    this.write({ family: { deletedAt: Date.now() } as FamilyDoc, kids: {} });
  }
  async deleteAccount() {
    await this.deleteAll();
  }
}
