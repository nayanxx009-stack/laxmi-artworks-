import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';

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

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Configure Firestore with auto-detect long polling and persistent multi-tab cache to prevent [code=unavailable] connection drops
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreInstance;
export const auth = getAuth(app);
const adminApp = getApps().find(a => a.name === 'adminApp') || initializeApp(firebaseConfig, 'adminApp');
export const adminAuth = getAuth(adminApp);
export const adminDb = db;
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
