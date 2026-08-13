import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  "projectId": "laxmi-artworks",
  "appId": "1:598865578283:web:edb8d8eb2eef1c9129dd6e",
  "apiKey": "AIzaSyCY2OXKl8QB-4-YqHNiLWRVcLXwn-xP-mY",
  "authDomain": "laxmi-artworks.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-laxmiartworks-323eeacf-ef7f-4ebf-be48-501590306148",
  "storageBucket": "laxmi-artworks.firebasestorage.app",
  "messagingSenderId": "598865578283",
  "measurementId": "",
  "oAuthClientId": "",
  "recaptchaSiteKey": ""
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const adminApp = initializeApp(firebaseConfig, 'adminApp');
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
export const adminStorage = getStorage(adminApp);
export const storage = getStorage(app);

let messagingInstance: any = null;

export async function getMessagingInstance() {
  if (typeof window === 'undefined') return null;
  if (messagingInstance) return messagingInstance;
  try {
    const supported = await isSupported();
    if (supported && 'serviceWorker' in navigator) {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
  } catch (err) {
    console.warn('[Firebase] Firebase Messaging isSupported check notice:', err);
  }
  return null;
}

export const messaging = typeof window !== 'undefined' && 'serviceWorker' in navigator ? (() => {
  try {
    return getMessaging(app);
  } catch (e) {
    return null;
  }
})() : null;

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
