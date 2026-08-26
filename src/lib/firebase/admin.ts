import 'server-only';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { appConfig, serverConfig } from '@/config';

/**
 * Admin SDK singletons. Next hot-reloads modules in dev, so the app is looked up before
 * being created — initializing twice throws.
 *
 * Under emulators, FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST must be set
 * before the SDK initialises, which is what `wireEmulatorHosts()` does.
 */

const ADMIN_APP_NAME = 'wallboard-admin';

function wireEmulatorHosts(): void {
  if (!appConfig.useEmulators) return;
  const { host, firestorePort, authPort, storagePort } = appConfig.emulator;
  process.env.FIRESTORE_EMULATOR_HOST ??= `${host}:${firestorePort}`;
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= `${host}:${authPort}`;
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= `${host}:${storagePort}`;
  // The Admin SDK still wants a project id even when everything is emulated.
  process.env.GOOGLE_CLOUD_PROJECT ??= appConfig.firebase.projectId;
}

function createApp(): App {
  wireEmulatorHosts();
  const { serviceAccountJson } = serverConfig();

  if (serviceAccountJson) {
    const parsed: unknown = JSON.parse(serviceAccountJson);
    return initializeApp(
      {
        credential: cert(parsed as Parameters<typeof cert>[0]),
        projectId: appConfig.firebase.projectId,
        storageBucket: appConfig.firebase.storageBucket,
      },
      ADMIN_APP_NAME,
    );
  }

  // Emulators need no credential; Cloud Run and a local GOOGLE_APPLICATION_CREDENTIALS
  // path are both picked up by Application Default Credentials.
  return initializeApp(
    {
      projectId: appConfig.firebase.projectId,
      storageBucket: appConfig.firebase.storageBucket,
    },
    ADMIN_APP_NAME,
  );
}

export function adminApp(): App {
  const existing = getApps().find((a) => a.name === ADMIN_APP_NAME);
  return existing ?? createApp();
}

let firestoreCache: Firestore | null = null;

export function db(): Firestore {
  if (firestoreCache) return firestoreCache;
  const instance = getFirestore(adminApp());
  instance.settings({ ignoreUndefinedProperties: true });
  firestoreCache = instance;
  return instance;
}

export function auth(): Auth {
  return getAuth(adminApp());
}
