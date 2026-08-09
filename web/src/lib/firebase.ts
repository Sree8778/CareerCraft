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
const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

// @ts-expect-error — intentional lazy init: null assigned here, overwritten in the isBrowser block below
let app: FirebaseApp = null;
// @ts-expect-error — intentional lazy init: null assigned here, overwritten in the isBrowser block below
let auth: Auth = null;
// @ts-expect-error — intentional lazy init: null assigned here, overwritten in the isBrowser block below
let db: Firestore = null;
// @ts-expect-error — intentional lazy init: null assigned here, overwritten in the isBrowser block below
let storage: FirebaseStorage = null;

if (isBrowser && hasFirebaseConfig) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (error) {
    // The app remains usable in local developer mode through AuthContext's
    // explicit fallback. Do not crash hydration when Firebase is incomplete.
    console.warn('Firebase client initialization was skipped:', error);
  }
}

export { app, auth, db, storage };
