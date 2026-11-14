// The Play Store build: no access keys, no lock screen, no owner code (see access.ts, which this
// replaces at build time). What remains is the Google button and this phone's label in the
// family document, made from a random id kept for this install.

import type { App } from './app.ts';

export { GOOGLE_G, googleButton } from './gbutton.ts';

const DEVICE_KEY = 'studyhard.device';
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
let label: string | null = null;

/** This phone's label ("K7Q4-MZ2P"): a short hash of a random id made once for this install. */
export async function myPhone(app: App): Promise<string> {
  if (label) return label;
  let id = '';
  try {
    id = (await app.native?.deviceId?.())?.id ?? '';
  } catch {
    id = '';
  }
  if (!id) {
    try {
      id = localStorage.getItem(DEVICE_KEY) ?? '';
      if (!id) {
        id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(DEVICE_KEY, id);
      }
    } catch {
      id = 'no-storage';
    }
  }
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`studyhard-phone:${id}`)));
  let bits = 0, acc = 0, s = '';
  for (const byte of h.slice(0, 5)) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      s += B32[(acc >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  label = `${s.slice(0, 4)}-${s.slice(4, 8)}`;
  return label;
}
