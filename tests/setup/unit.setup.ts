/**
 * Unit tests import modules that read config at load time, so the public env has to exist
 * before anything else is imported. These are placeholders — no unit test talks to
 * Firebase or Google Cloud.
 */
process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??= 'test-api-key';
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??= 'wallboard-test.firebaseapp.com';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??= 'wallboard-test';
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??= 'wallboard-test.appspot.com';
process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??= '1:000000000000:web:test';
process.env.NEXT_PUBLIC_SITE_URL ??= 'http://localhost:3000';
process.env.JOIN_CODE_PEPPER ??= 'unit-test-pepper-value-0123456789';
process.env.OWNER_EMAILS ??= 'owner@example.com';
