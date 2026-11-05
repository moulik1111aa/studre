// The Firebase project MN signs in to and syncs with (project "mn-mission-next", from
// google-services.json). These values are not secrets: every Android app carries them, and
// the cloud is protected by firestore.rules (only approved accounts, only their own family).
// Test runs and debug builds use a stand-in cloud with `?debug&cloudmock`.

import type { FirebaseConfig } from './cloudapi.ts';

export const FIREBASE: FirebaseConfig | null = {
  apiKey: 'AIzaSyB_12oKrPeiNa2gBjyQUJFc0W18kdblYPo',
  projectId: 'mn-mission-next',
  // OAuth client type 3 (the "Web client"): the audience of the Google ID token.
  webClientId: '714580703646-3f7mahir625a8vb8p0733eu2b1te3mna.apps.googleusercontent.com',
};
