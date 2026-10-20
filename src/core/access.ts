// Access keys: each phone shows a short phone code; the owner's hidden area makes a key for
// that code with a name and an expiry date. The key is a digital signature (ECDSA P-256),
// so it works only on that phone, only until its expiry, and only the owner can make one:
// the app holds the public half of the signing key; the private half (the "master key")
// is never in the app or the repository, only on the owner's own phone.
//
// Works offline. A key cannot be switched off early (there is no server to ask); it stops
// on its expiry date, and key ids listed in REVOKED stop in the next app update.

const PUBLIC_KEY = 'BJ-JLA2WB9N-NXIJQ6pPejBUAozZQloQoJTn7gZk5Ztf0PlQb0VWlhY3BHgaegukg6nh-12Ifr84grPZ4iOaPLA';
/** The owner code (typed into a grown-up check) is checked against this PBKDF2 hash. */
const OWNER = { salt: '_Yw8Tg2CuWS1ztVe75SHiA', hash: 'SmWJftC5XbPVHuQapwQC9gt1X35Sb04YSjvZq2gNsvw', iterations: 150000 };
/** Key ids that stop working from this build on (ask for one to be added). */
export const REVOKED: string[] = [];

const enc = new TextEncoder();
const subtle = (): SubtleCrypto => globalThis.crypto.subtle;

// ── encodings ──────────────────────────────────────────────────────────────

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford: no I, L, O, U
export function toB32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
export function fromB32(s: string): Uint8Array<ArrayBuffer> | null {
  const clean = s.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const v = B32.indexOf(ch);
    if (v < 0) return null;
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}
const b64u = (s: string): Uint8Array<ArrayBuffer> => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const toB64u = (u: Uint8Array): string => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// ── days ───────────────────────────────────────────────────────────────────

const EPOCH = Date.UTC(2026, 0, 1);
/** "2026-03-14" → days since 1 Jan 2026. */
export const dayNo = (day: string): number => {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86_400_000);
};
export const dayOf = (n: number): string => new Date(EPOCH + n * 86_400_000).toISOString().slice(0, 10);

// ── phone codes ────────────────────────────────────────────────────────────

/** A short code for this phone, e.g. "K7Q4-MZ2P", from a stable device id. */
export async function phoneCode(deviceId: string): Promise<string> {
  const h = new Uint8Array(await subtle().digest('SHA-256', enc.encode(`studyhard-phone:${deviceId}`)));
  const s = toB32(h.slice(0, 5));
  return `${s.slice(0, 4)}-${s.slice(4, 8)}`;
}
/** Tidy a typed phone code ("k7q4mz2p" → "K7Q4-MZ2P"); null if it is not 8 characters. */
export function tidyPhone(s: string): string | null {
  const b = s.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return b.length === 8 && [...b].every((c) => B32.includes(c)) ? `${b.slice(0, 4)}-${b.slice(4)}` : null;
}

// ── keys ───────────────────────────────────────────────────────────────────

/** What a key says: which phone, until when, and its id (for the owner's list and REVOKED). */
const message = (phone: string, until: number, id: string) => enc.encode(`SH1|${phone}|${until}|${id}`);

function publicKey(): Promise<CryptoKey> {
  return subtle().importKey('raw', b64u(PUBLIC_KEY), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
}

/** The owner's signing key, from the master key ("SHMK-…"). Null if it doesn't fit the app's public key. */
export async function signingKey(master: string): Promise<CryptoKey | null> {
  const d = master.trim().replace(/^SHMK-/i, '');
  const pub = b64u(PUBLIC_KEY);
  try {
    const key = await subtle().importKey('jwk', { kty: 'EC', crv: 'P-256', d, x: toB64u(pub.slice(1, 33)), y: toB64u(pub.slice(33, 65)), ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    // Prove it matches: sign and verify a test message.
    const test = enc.encode('studyhard-master-check');
    const sig = await subtle().sign({ name: 'ECDSA', hash: 'SHA-256' }, key, test);
    return (await subtle().verify({ name: 'ECDSA', hash: 'SHA-256' }, await publicKey(), sig, test)) ? key : null;
  } catch {
    return null;
  }
}

/** Make a key for a phone, valid up to and including day `until`. */
export async function makeKey(signer: CryptoKey, phone: string, until: number, id = randomId()): Promise<{ key: string; id: string }> {
  const sig = new Uint8Array(await subtle().sign({ name: 'ECDSA', hash: 'SHA-256' }, signer, message(phone, until, id)));
  const idBytes = fromB32(id)!;
  const body = new Uint8Array(2 + idBytes.length + sig.length);
  body[0] = until >> 8;
  body[1] = until & 255;
  body.set(idBytes, 2);
  body.set(sig, 2 + idBytes.length);
  return { key: `SH-${toB32(body)}`, id };
}

/** A random key id: 5 characters (3 random bytes). */
export function randomId(): string {
  return toB32(globalThis.crypto.getRandomValues(new Uint8Array(3)));
}

export type KeyCheck = { ok: true; until: number; id: string } | { ok: false; reason: 'bad' | 'other-phone' | 'expired' | 'revoked'; until?: number };

/** Check a key for this phone on this day. */
export async function checkKey(key: string, phone: string, today: string): Promise<KeyCheck> {
  const bytes = fromB32(key.replace(/^\s*SH-?/i, ''));
  // 2 bytes date + 3 bytes id (5 base-32 characters → 25 bits, stored as 3 bytes) + 64 bytes signature.
  if (!bytes || bytes.length < 2 + 3 + 64) return { ok: false, reason: 'bad' };
  const until = (bytes[0] << 8) | bytes[1];
  const idBytes = bytes.slice(2, 2 + 3);
  const id = toB32(idBytes).slice(0, 5);
  const sig = bytes.slice(5, 5 + 64);
  let good = false;
  try {
    good = await subtle().verify({ name: 'ECDSA', hash: 'SHA-256' }, await publicKey(), sig, message(phone, until, id));
  } catch {
    good = false;
  }
  if (!good) {
    // Signed, but for a different phone? We can't tell for sure; treat any failure the same.
    return { ok: false, reason: 'bad' };
  }
  if (REVOKED.includes(id)) return { ok: false, reason: 'revoked', until };
  if (dayNo(today) > until) return { ok: false, reason: 'expired', until };
  return { ok: true, until, id };
}

/** Is this the owner's code? (Typed into a grown-up check.) */
export async function isOwnerCode(code: string): Promise<boolean> {
  if (!/^\d{7}$/.test(code)) return false;
  try {
    const base = await subtle().importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64u(OWNER.salt), iterations: OWNER.iterations }, base, 256);
    return toB64u(new Uint8Array(bits)) === OWNER.hash;
  } catch {
    return false;
  }
}
