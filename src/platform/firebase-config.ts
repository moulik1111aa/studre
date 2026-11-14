// The Firebase project MN signs in to and syncs with (project "mn-mission-next").
// The Web API key is not kept in the code: the build adds it from the FIREBASE_API_KEY
// secret (scripts/build.mjs). Without it, Google sign-in stays hidden. The cloud itself is
// protected by firestore.rules (only approved accounts, only their own family), and the key
// is limited to the sign-in APIs in Google Cloud.
// Browser test runs use a stand-in cloud instead (see ui/cloud.ts).

import type { FirebaseConfig } from './cloudapi.ts';

const key = (globalThis as { __BUILD__?: { firebaseKey?: string } }).__BUILD__?.firebaseKey ?? '';

export const FIREBASE: FirebaseConfig | null = key
  ? {
      apiKey: key,
      projectId: 'mn-mission-next',
      // OAuth client type 3 (the "Web client"): the audience of the Google ID token.
      webClientId: '714580703646-3f7mahir625a8vb8p0733eu2b1te3mna.apps.googleusercontent.com',
    }
  : null;
