import { getToken, onMessage } from "firebase/messaging";
import { messaging, db } from "./firebase";
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";

export function getBrowserInfo() {
  if (typeof navigator === 'undefined') return { platform: 'Unknown', browser: 'Unknown', userAgent: '' };
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('SamsungBrowser')) browser = 'Samsung Internet';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';
  else if (ua.includes('Trident')) browser = 'Internet Explorer';
  else if (ua.includes('Edge') || ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  let platform = 'Desktop';
  if (/Android/i.test(ua)) platform = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) platform = 'iOS';
  else if (/Win/i.test(ua)) platform = 'Windows';
  else if (/Mac/i.test(ua)) platform = 'Mac';
  else if (/Linux/i.test(ua)) platform = 'Linux';

  return { platform, browser, userAgent: ua };
}

export const requestFCMToken = async (userId: string, email: string) => {
  if (!messaging || typeof window === 'undefined') return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const getTokenOptions: any = { serviceWorkerRegistration: registration };
      
      const vapidKey = import.meta.env.VITE_VAPID_KEY || (window as any).VAPID_KEY;
      if (vapidKey) {
        getTokenOptions.vapidKey = vapidKey;
      }
      
      const token = await getToken(messaging, getTokenOptions);
      if (token) {
        const { platform, browser, userAgent } = getBrowserInfo();
        const safeTokenId = token.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100);
        const now = Date.now();

        // 1. Save in multi-device subcollection: users/{userId}/notificationTokens/{safeTokenId}
        const userTokenDocRef = doc(db, 'users', userId, 'notificationTokens', safeTokenId);
        const existingDocSnap = await getDoc(userTokenDocRef);
        const createdAt = existingDocSnap.exists() ? existingDocSnap.data().createdAt || now : now;

        await setDoc(userTokenDocRef, {
          token,
          userId,
          email: email.toLowerCase(),
          createdAt,
          updatedAt: now,
          lastSeenAt: now,
          platform,
          browser,
          userAgent,
          enabled: true
        }, { merge: true });

        // 2. Save/merge in fcm_tokens/{userId} for backward compatibility
        const fcmDocRef = doc(db, 'fcm_tokens', userId);
        const docSnap = await getDoc(fcmDocRef);
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
        await setDoc(fcmDocRef, {
          tokens,
          token, // legacy
          userId,
          email: email.toLowerCase(),
          updatedAt: now
        }, { merge: true });

        // 3. Register token with backend topic subscription 'all_users'
        try {
          await fetch('/api/subscribe-topic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, topic: 'all_users' })
          });
        } catch (subErr) {
          console.warn('[FCM] Failed to auto-subscribe topic:', subErr);
        }

        return token;
      }
    }
  } catch (error) {
    console.error("FCM Token error", error);
  }
  return null;
};

export const unregisterFCMToken = async (userId: string, token: string) => {
  try {
    const safeTokenId = token.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100);
    await deleteDoc(doc(db, 'users', userId, 'notificationTokens', safeTokenId));
    
    // Also remove from fcm_tokens
    const fcmDocRef = doc(db, 'fcm_tokens', userId);
    const docSnap = await getDoc(fcmDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.tokens && Array.isArray(data.tokens)) {
        const newTokens = data.tokens.filter((t: string) => t !== token);
        await setDoc(fcmDocRef, { tokens: newTokens }, { merge: true });
      }
    }
  } catch (err) {
    console.error('[FCM] Error unregistering token:', err);
  }
};

export const onForegroundMessage = (callback: (payload: any) => void) => {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
};
