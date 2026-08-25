import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App instance safely
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore Database with force long-polling for immediate, reliable connection across iframe/sandboxed environments
let db: ReturnType<typeof getFirestore>;
try {
  db = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
    },
    firebaseConfig.firestoreDatabaseId || undefined
  );
} catch {
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
}

export { app, db };
export default db;
