import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Firebase must only be initialised in the browser.
// During Next.js SSR / build-time static generation the NEXT_PUBLIC_*
// variables are not available, and calling initializeApp would throw
// FirebaseError: auth/invalid-api-key.
// All pages that use Firebase are already marked 'use client' +
// force-dynamic, so these stubs are never exercised at runtime.
const isBrowser = typeof window !== 'undefined';

// @ts-expect-error — intentional lazy init; value assigned below
let app: FirebaseApp = null;
// @ts-expect-error
let auth: Auth = null;
// @ts-expect-error
let db: Firestore = null;
// @ts-expect-error
let storage: FirebaseStorage = null;

if (isBrowser) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export { app, auth, db, storage };
