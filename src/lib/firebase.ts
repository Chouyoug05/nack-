import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || "AIzaSyDh5nXHVExL7O0ybTqa_35NFPZwKONmeWA",
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || "nack-c7adb.firebaseapp.com",
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || "nack-c7adb",
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || "nack-c7adb.appspot.com",
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "412543420411",
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || "1:412543420411:web:2c423addfab96ac627ed5e",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

// Firestore avec cache persistant (offline-first) et multi-onglets
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
  experimentalForceLongPolling: true,
});

export const storage = getStorage(app); 