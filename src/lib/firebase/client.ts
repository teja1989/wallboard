'use client';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { appConfig } from '@/config';

/**
 * Browser SDK singletons. Only Auth (identity) and Firestore (live wall reads) are wired
 * up — the browser never touches Storage directly, since every object read and write goes
 * through a server-issued URL.
 */

let firestoreInstance: Firestore | null = null;
let emulatorsConnected = false;

export function firebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(appConfig.firebase);
}

function connectEmulatorsOnce(authInstance: Auth, db: Firestore): void {
  if (emulatorsConnected || !appConfig.useEmulators) return;
  emulatorsConnected = true;
  // Match the browser's hostname (e.g. localhost vs 127.0.0.1) so Auth Emulator postMessage frame origins match exactly.
  const host =
    typeof window !== 'undefined' && window.location.hostname
      ? window.location.hostname
      : appConfig.emulator.host;
  const { authPort, firestorePort } = appConfig.emulator;
  connectAuthEmulator(authInstance, `http://${host}:${authPort}`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, firestorePort);
}

/**
 * Firestore with an IndexedDB-backed cache.
 *
 * This is a billing decision as much as a speed one. Without it, every visit to a wall
 * re-downloads every post document, and a guest who checks back five times during a party
 * pays for the whole wall five times. With it the listener resumes from where it left off
 * and only genuinely new posts cross the wire — a returning guest costs close to nothing,
 * and the wall paints from disk before the network answers.
 *
 * The multi-tab manager matters because people leave the wall open on a laptop and open it
 * again on a phone-sized window; without it the second tab would fail to acquire the lease
 * and silently fall back to no cache.
 */
function createFirestore(): Firestore {
  const app = firebaseApp();
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (error) {
    // Private browsing and a few locked-down mobile browsers deny IndexedDB outright, and
    // hot reload can re-enter this with the instance already configured. Neither is worth
    // breaking the wall over: an in-memory cache still works, it just costs more reads.
    console.warn('[firebase] falling back to the in-memory cache', error);
    return initializeFirestore(app, {});
  }
}

export function clientAuth(): Auth {
  const instance = getAuth(firebaseApp());
  connectEmulatorsOnce(instance, clientDb());
  return instance;
}

export function clientDb(): Firestore {
  if (!firestoreInstance) {
    firestoreInstance = createFirestore();
    connectEmulatorsOnce(getAuth(firebaseApp()), firestoreInstance);
  }
  return firestoreInstance;
}
