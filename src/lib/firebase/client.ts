'use client';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { appConfig } from '@/config';

/**
 * Browser SDK singletons. Only Auth (identity) and Firestore (live wall reads) are wired
 * up — the browser never touches Storage directly, since every object read and write goes
 * through a server-issued URL.
 */

let emulatorsConnected = false;

export function firebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(appConfig.firebase);
}

function connectEmulatorsOnce(authInstance: Auth, firestoreInstance: Firestore): void {
  if (emulatorsConnected || !appConfig.useEmulators) return;
  emulatorsConnected = true;
  const { host, authPort, firestorePort } = appConfig.emulator;
  connectAuthEmulator(authInstance, `http://${host}:${authPort}`, { disableWarnings: true });
  connectFirestoreEmulator(firestoreInstance, host, firestorePort);
}

export function clientAuth(): Auth {
  const instance = getAuth(firebaseApp());
  connectEmulatorsOnce(instance, getFirestore(firebaseApp()));
  return instance;
}

export function clientDb(): Firestore {
  const instance = getFirestore(firebaseApp());
  connectEmulatorsOnce(getAuth(firebaseApp()), instance);
  return instance;
}
