import { getToken, onMessage } from "firebase/messaging";
import { getMessagingInstance, db } from "./firebase";
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

export interface FCMRegistrationResult {
  success: boolean;
  token?: string;
  error?: string;
  code?: string;
  step?: string;
}

export const requestFCMToken = async (userId: string, email: string): Promise<FCMRegistrationResult> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn("[FCM] Notification permission: Browser unsupported or SSR");
    return { success: false, error: 'Web Push Notifications are not supported in this browser.', step: 'browser-support' };
  }

  try {
    // 1. Browser permission
    console.log("[FCM] Notification permission: Requesting browser permission...");
    const permission = await Notification.requestPermission();
    console.log(`[FCM] Notification permission: ${permission}`);

    if (permission !== 'granted') {
      const errMsg = permission === 'denied' 
        ? 'Notifications are blocked in browser settings.' 
        : 'Notification permission was not granted.';
      return { success: false, error: errMsg, step: 'browser-permission' };
    }

    // 2. Firebase initialization
    console.log("[FCM] Firebase initialized: Loading messaging instance...");
    const messaging = await getMessagingInstance();
    if (!messaging) {
      console.error("[FCM] Firebase initialized: Failed to obtain messaging instance");
      return { success: false, error: 'Firebase Messaging is not supported or failed to initialize in this browser.', step: 'firebase-init' };
    }
    console.log("[FCM] Firebase initialized: Messaging instance ready");

    // 3. Service worker registration
    console.log("[FCM] Service worker registration: Registering /firebase-messaging-sw.js");
    let registration: ServiceWorkerRegistration;
    try {
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      console.log("[FCM] Service worker registration: Scope =", registration.scope);
    } catch (swErr: any) {
      console.error("[FCM] Service worker registration failed:", swErr);
      return { 
        success: false, 
        error: `Service worker registration failed: ${swErr.message || swErr}`, 
        step: 'service-worker-reg' 
      };
    }

    // 4. Service worker active
    console.log("[FCM] Service worker active: Checking serviceWorker.ready...");
    try {
      await navigator.serviceWorker.ready;
      console.log("[FCM] Service worker active: Ready and active");
    } catch (activeErr: any) {
      console.warn("[FCM] Service worker active notice:", activeErr);
    }

    // 5. VAPID configuration
    const vapidKey = import.meta.env.VITE_VAPID_KEY || (typeof window !== 'undefined' ? (window as any).VAPID_KEY : undefined);
    const isVapidPresent = !!(vapidKey && typeof vapidKey === 'string' && vapidKey.trim().length > 0);
    console.log(`[FCM] VAPID key present: ${isVapidPresent ? 'YES' : 'NO'}`);

    const getTokenOptions: any = { serviceWorkerRegistration: registration };
    if (isVapidPresent) {
      getTokenOptions.vapidKey = vapidKey.trim();
    }

    // 6. Calling getToken
    console.log("[FCM] Calling getToken: Requesting FCM Web token...");
    let token = '';
    try {
      token = await getToken(messaging, getTokenOptions);
    } catch (getTokenErr: any) {
      console.error("[FCM] Calling getToken error:", getTokenErr);
      let userErrMsg = getTokenErr.message || 'Failed to generate FCM Web Push Token';
      if (getTokenErr.code === 'messaging/missing-vapid-key') {
        userErrMsg = 'VAPID public key is missing or not configured for Web Push. Web Push requires VITE_VAPID_KEY.';
      } else if (getTokenErr.code === 'messaging/failed-service-worker-registration') {
        userErrMsg = 'Service worker failed to register FCM token.';
      }
      return { 
        success: false, 
        error: userErrMsg, 
        code: getTokenErr.code, 
        step: 'getToken' 
      };
    }

    // 7. Token validation
    if (!token || token.trim().length === 0) {
      console.error("[FCM] Token generated: Received empty token");
      return { success: false, error: 'Firebase returned an empty notification token.', step: 'getToken' };
    }
    console.log(`[FCM] Token generated: Success (${token.substring(0, 15)}...)`);

    // 8. Firestore token save & Server API registration
    console.log("[FCM] Token saved: Saving token to Firestore and Server API...");
    const { platform, browser, userAgent } = getBrowserInfo();
    const safeTokenId = token.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100);
    const now = Date.now();

    // Client-side Firestore write
    try {
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
        token,
        userId,
        email: email.toLowerCase(),
        updatedAt: now
      }, { merge: true });
    } catch (fsErr) {
      console.warn("[FCM] Token saved: Client Firestore notice:", fsErr);
    }

    // Backend Server API write
    try {
      const regRes = await fetch('/api/register-fcm-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email,
          token,
          platform,
          browser,
          userAgent
        })
      });
      const regData = await regRes.json();
      console.log("[FCM] Token saved: Server API registered successfully:", regData);
    } catch (serverErr) {
      console.warn("[FCM] Token saved: Server API notice:", serverErr);
    }

    // Save token registered state locally
    localStorage.setItem('fcm_token_registered', 'true');
    console.log("[FCM] Final status: SUCCESS");

    return { success: true, token, step: 'complete' };
  } catch (err: any) {
    console.error("[FCM] Final status: ERROR", err);
    return { success: false, error: err.message || 'Unexpected FCM error', step: 'unknown' };
  }
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

export const onForegroundMessage = async (callback: (payload: any) => void) => {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
};
