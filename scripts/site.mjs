// The website on Firebase Hosting (https://mn-mission-next.web.app): the home page, the
// privacy policy, and MN Access (/admin), the owner's page for approving people.
// Usage: node scripts/site.mjs [outDir]   (default _site; tests build into dist/site)
// The Firebase Web API key comes from FIREBASE_API_KEY (a GitHub secret) or .firebase-key.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle, scriptSafe } from './build.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, process.argv[2] ?? '_site');

const key = (() => {
  if (process.env.FIREBASE_API_KEY) return process.env.FIREBASE_API_KEY.trim();
  try {
    return readFileSync(join(root, '.firebase-key'), 'utf8').trim();
  } catch {
    return '';
  }
})();
const config = {
  apiKey: key,
  projectId: 'mn-mission-next',
  authDomain: 'mn-mission-next.firebaseapp.com',
  webClientId: '714580703646-3f7mahir625a8vb8p0733eu2b1te3mna.apps.googleusercontent.com',
};

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'admin'), { recursive: true });
cpSync(join(root, 'site'), out, { recursive: true });

const css = readFileSync(join(root, 'src', 'admin', 'admin.css'), 'utf8');
const js = bundle(join(root, 'src', 'admin', 'main.ts'));
const FB = 'https://www.gstatic.com/firebasejs/10.12.2';
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<title>MN Access</title>
<meta name="theme-color" content="#3D4BE0">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="MN Access">
<link rel="apple-touch-icon" href="../assets/icon-512.png">
<link rel="icon" href="../assets/icon-512.png">
<link rel="manifest" href="manifest.webmanifest">
<style>${css}</style>
</head>
<body>
<main id="admin"><p class="loading">Loading…</p></main>
<script>window.__ADMIN__=${JSON.stringify(config)};</script>
<script type="module">
  // Google's own sign-in window (Firebase), for the owner's ID token.
  import { initializeApp } from '${FB}/firebase-app.js';
  import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from '${FB}/firebase-auth.js';
  const c = window.__ADMIN__;
  if (c && c.apiKey) {
    const auth = getAuth(initializeApp({ apiKey: c.apiKey, authDomain: c.authDomain, projectId: c.projectId }));
    window.__fbSignIn = {
      async googleIdToken() {
        const p = new GoogleAuthProvider();
        p.setCustomParameters({ prompt: 'select_account' });
        const r = await signInWithPopup(auth, p);
        const cred = GoogleAuthProvider.credentialFromResult(r);
        if (!cred || !cred.idToken) throw new Error('no token');
        return cred.idToken;
      },
      signOut: () => signOut(auth),
    };
  }
</script>
<script>${scriptSafe(js)}</script>
</body>
</html>
`;
writeFileSync(join(out, 'admin', 'index.html'), page);
writeFileSync(
  join(out, 'admin', 'manifest.webmanifest'),
  JSON.stringify({ name: 'MN Access', short_name: 'MN Access', start_url: '/admin', display: 'standalone', background_color: '#F6F7FB', theme_color: '#3D4BE0', icons: [{ src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2),
);
console.log(`website → ${out}${key ? '' : ' (no API key: sign-in won’t work)'}`);
