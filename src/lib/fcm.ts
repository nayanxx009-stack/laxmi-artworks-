import { getToken, onMessage } from "firebase/messaging";
import { messaging, db } from "./firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

export const requestFCMToken = async (userId: string, email: string) => {
  if (!messaging) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const getTokenOptions: any = { serviceWorkerRegistration: registration };
      if (import.meta.env.VITE_VAPID_KEY) {
        getTokenOptions.vapidKey = import.meta.env.VITE_VAPID_KEY;
      }
      const token = await getToken(messaging, getTokenOptions);
      if (token) {
        const userDocRef = doc(db, 'fcm_tokens', userId);
        const docSnap = await getDoc(userDocRef);
        let tokens = [token];
        if (docSnap.exists()) {
           const existingData = docSnap.data();
           if (existingData.tokens && Array.isArray(existingData.tokens)) {
              if (!existingData.tokens.includes(token)) {
                 tokens = [...existingData.tokens, token];
              } else {
                 tokens = existingData.tokens;
              }
           } else if (existingData.token && existingData.token !== token) {
              tokens = [existingData.token, token];
           }
        }
        await setDoc(userDocRef, {
          tokens,
          token, // legacy support
          userId,
          email: email.toLowerCase(),
          updatedAt: Date.now()
        }, { merge: true });
        return token;
      }
    }
  } catch (error) {
    console.error("FCM Token error", error);
  }
  return null;
};

export const onForegroundMessage = (callback: (payload: any) => void) => {
  if (!messaging) return null;
  return onMessage(messaging, callback);
};
