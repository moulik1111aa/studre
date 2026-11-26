// What went wrong when signing in with Google, in plain words, with a code (review fix 16).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firebaseProblem as fp, sheetProblem as sp, type SheetAnswer } from '../src/core/signinerror.ts';

// Codes are shown with hyphens that don't break across lines; compare them as plain hyphens.
const plain = <T extends { text: string }>(p: T): T => ({ ...p, text: p.text.replace(/\u2011/g, '-') });
const sheetProblem = (a: SheetAnswer) => plain(sp(a));
const firebaseProblem = (status: number, body: unknown) => plain(fp(status, body));

test('codes in messages don’t break across lines', () => {
  assert.ok(sp({ kind: 'custom' }).text.includes('G\u2011CUSTOM'));
  assert.equal(sp({ kind: 'custom' }).code, 'G-CUSTOM');
});

test('the phone’s Google sheet: each kind of failure says what to do', () => {
  assert.equal(sheetProblem({ kind: 'no-credential', message: 'No credentials available' }).code, 'G-NONE');
  assert.match(sheetProblem({ kind: 'no-credential' }).text, /Settings → Accounts/);
  assert.equal(sheetProblem({ kind: 'provider-config', message: 'getCredentialAsync no provider dependencies found' }).code, 'G-PLAY');
  assert.match(sheetProblem({ kind: 'unsupported' }).text, /Google Play services/);
  assert.equal(sheetProblem({ kind: 'interrupted' }).code, 'G-AGAIN');
  assert.equal(sheetProblem({ kind: 'bad-credential' }).code, 'G-READ');
  // Google's numbered errors: not set up for this app's key (10, 28444), the account wants signing in again (16).
  assert.equal(sheetProblem({ kind: 'custom', message: '[28444] Developer console is not set up correctly.' }).code, 'G-SETUP-28444');
  assert.equal(sheetProblem({ kind: 'unknown', message: '[10] ' }).code, 'G-SETUP-10');
  assert.equal(sheetProblem({ kind: 'no-client-id' }).code, 'G-SETUP');
  assert.equal(sheetProblem({ kind: 'unknown', message: '[16] Account reauth failed.' }).code, 'G-16');
  // Anything else: a code to pass on (a number Google gave, or the kind).
  assert.deepEqual(sheetProblem({ kind: 'unknown', message: 'On Begin Sign In Failure: [8] Unknown internal error.' }).code, 'G-8');
  assert.equal(sheetProblem({ kind: 'custom' }).code, 'G-CUSTOM');
  assert.equal(sheetProblem({}).code, 'G-OTHER');
  assert.match(sheetProblem({ kind: 'custom' }).text, /tell us the code G-CUSTOM/);
  // An older app sends only `error`: still read.
  assert.equal(sheetProblem({ error: 'GetCredentialCustomException: [28444] Developer console is not set up correctly.' }).code, 'G-SETUP-28444');
});

test('Firebase refusing Google’s answer: the key, the setup, the clock, the account, too many', () => {
  const err = (status: number, message: string, reason?: string) => firebaseProblem(status, { error: { code: status, message, ...(reason ? { details: [{ reason }] } : {}) } });
  assert.equal(err(400, 'API key not valid. Please pass a valid API key.', 'API_KEY_INVALID').code, 'F-KEY');
  assert.equal(err(403, 'Requests from this Android client application <empty> are blocked.', 'API_KEY_ANDROID_APP_BLOCKED').code, 'F-KEY');
  assert.equal(err(403, 'Requests to this API identitytoolkit.googleapis.com method google.cloud.identitytoolkit.v1.AuthenticationService.SignInWithIdp are blocked.').code, 'F-KEY');
  assert.equal(err(400, 'OPERATION_NOT_ALLOWED').code, 'F-OFF');
  assert.equal(err(400, 'INVALID_IDP_RESPONSE : Invalid Idp Response: the Google id_token is not allowed to be used with this application. Its audience (OAuth 2.0 client ID) is 1-x, which is not authorized to be used in the project with project_number: 7.').code, 'F-AUD');
  const clock = err(400, 'INVALID_IDP_RESPONSE : The supplied auth credential is malformed or has expired.');
  assert.equal(clock.code, 'F-IDP');
  assert.match(clock.text, /date and time/);
  assert.equal(err(400, 'USER_DISABLED : The user account has been disabled by an administrator.').code, 'F-USER');
  const busy = err(400, 'TOO_MANY_ATTEMPTS_TRY_LATER');
  assert.equal(busy.code, 'F-BUSY');
  assert.ok(busy.busy);
  assert.equal(firebaseProblem(429, {}).code, 'F-BUSY');
  // Anything else: the HTTP status as the code.
  assert.equal(firebaseProblem(500, 'not json').code, 'F-500');
  assert.equal(firebaseProblem(0, null).code, 'F-X');
  assert.match(firebaseProblem(500, {}).text, /tell us the code F-500/);
});
