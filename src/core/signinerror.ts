// What went wrong when signing in with Google, in plain words, and what to do (review fix 16).
// Two steps can fail: Google's account sheet on the phone (Credential Manager, StudyHardPlugin
// googleSignIn), and Firebase checking Google's answer (FirebaseRest). Each message ends with a
// short code a parent can pass on, so the cause can be found without the phone.

/** What the phone's Google sheet answered (native googleSignIn). `kind` is set by StudyHardPlugin. */
export interface SheetAnswer {
  kind?: string;
  type?: string;
  message?: string;
  error?: string;
}

export interface SignInProblem {
  text: string;
  code: string;
}

/** A code as shown: its hyphens don't break across lines (it reads the same). */
const shown = (code: string) => code.replace(/-/g, '\u2011');
const tellUs = (code: string) => `If it keeps happening, tell us the code ${shown(code)}.`;

/** The phone's Google sheet failed (not cancelled). */
export function sheetProblem(a: SheetAnswer): SignInProblem {
  const msg = `${a.message ?? ''} ${a.error ?? ''}`;
  const num = /\[(\d+)\]/.exec(msg)?.[1];
  // Google's own codes first: the app isn't registered for this signing key (10 / 28444), or the
  // account needs signing in to again (16).
  if (num === '10' || num === '28444' || /developer console/i.test(msg) || a.kind === 'no-client-id') {
    const code = `G-SETUP${num ? `-${num}` : ''}`;
    return { code, text: `This copy of MN can’t use Google sign-in yet. Please update MN. ${tellUs(code)}` };
  }
  if (num === '16' || /reauth/i.test(msg)) {
    return { code: 'G-16', text: 'Google wants you to sign in to your account again on this phone (Settings → Accounts → Google). Then try again here.' };
  }
  switch (a.kind) {
    case 'no-credential':
      return { code: 'G-NONE', text: 'There’s no Google account on this phone to sign in with. Add a parent’s Google account in the phone’s Settings → Accounts, then try again. (A child’s account can’t be used.)' };
    case 'provider-config':
    case 'unsupported':
      return { code: 'G-PLAY', text: `Signing in needs a newer Google Play services. Update it from the Play Store, then try again. (${shown('G-PLAY')})` };
    case 'interrupted':
      return { code: 'G-AGAIN', text: 'Signing in was interrupted. Please try again.' };
    case 'bad-credential':
    case 'unexpected-credential':
      return { code: 'G-READ', text: `Google’s answer couldn’t be read. Please try again. ${tellUs('G-READ')}` };
  }
  const code = `G-${num ?? (a.kind || 'OTHER').toUpperCase()}`;
  return { code, text: `Google sign-in didn’t work. Please try again. ${tellUs(code)}` };
}

/** Firebase refused Google's answer (an HTTP error from accounts:signInWithIdp). */
export function firebaseProblem(status: number, body: unknown): SignInProblem & { busy: boolean } {
  const e = ((body && typeof body === 'object' ? (body as { error?: unknown }).error : null) ?? {}) as { message?: unknown; details?: unknown };
  const msg = String(e.message ?? '');
  const reasons = Array.isArray(e.details) ? e.details.map((d) => String((d as { reason?: unknown })?.reason ?? '')) : [];
  const has = (re: RegExp) => re.test(msg) || reasons.some((r) => re.test(r));
  const no = (code: string, text: string) => ({ code, text, busy: false });
  // The app's key for Firebase is wrong, or limited so that this phone can't use it.
  if (has(/API[_ ]?KEY|are blocked/i)) return no('F-KEY', `MN can’t reach Google sign-in right now. Please try again later. ${tellUs('F-KEY')}`);
  if (has(/OPERATION_NOT_ALLOWED|CONFIGURATION_NOT_FOUND/)) return no('F-OFF', `Google sign-in is switched off for MN right now. ${tellUs('F-OFF')}`);
  if (has(/INVALID_IDP_RESPONSE/)) {
    // Google's answer was for another app (audience), or expired / not yet valid (the phone's clock).
    if (/audience|not authorized|not allowed/i.test(msg)) return no('F-AUD', `This copy of MN can’t use Google sign-in. Please update MN. ${tellUs('F-AUD')}`);
    return no('F-IDP', `Google’s answer couldn’t be checked. Make sure the phone’s date and time are set automatically (Settings → Date & time), then try again. (${shown('F-IDP')})`);
  }
  if (has(/USER_DISABLED/)) return no('F-USER', `This Google account can’t be used with MN. ${tellUs('F-USER')}`);
  if (status === 429 || has(/TOO_MANY_ATTEMPTS|QUOTA_EXCEEDED|RESOURCE_EXHAUSTED/)) return { code: 'F-BUSY', text: `Too many sign-ins just now. Please wait a few minutes and try again. (${shown('F-BUSY')})`, busy: true };
  const code = `F-${status || 'X'}`;
  return no(code, `Google sign-in didn’t work. Please try again. ${tellUs(code)}`);
}

/** No connection at all (a phone clock far off breaks secure connections too). */
export const OFFLINE_SIGN_IN = 'No internet connection, or the phone’s date and time are wrong. Check both, then try again.';
