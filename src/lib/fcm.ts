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
  details?: any;
}

export interface FCMDiagnosticReport {
  permission: NotificationPermission | 'unsupported';
  vapidKeyDetected: boolean;
  vapidSource?: string;
  serviceWorkerRegistered: boolean;
  serviceWorkerScope?: string;
  fcmTokenGenerated: boolean;
  tokenPreview?: string;
  firestoreSaved: boolean;
  backendRegistered: boolean;
  error?: string;
  stepFailed?: string;
}

let cachedVapidKey: string | null = null;

export async function getVapidKey(): Promise<string | undefined> {
  if (cachedVapidKey && cachedVapidKey.trim().length > 0) {
    return cachedVapidKey;
  }

  // 1. Check build-time env
  const envVapid = import.meta.env.VITE_VAPID_KEY;
  if (envVapid && typeof envVapid === 'string' && envVapid.trim().length > 0) {
    cachedVapidKey = envVapid.trim();
    return cachedVapidKey;
  }

  // 2. Check window global
  if (typeof window !== 'undefined' && (window as any).VAPID_KEY) {
    const wVapid = (window as any).VAPID_KEY;
    if (typeof wVapid === 'string' && wVapid.trim().length > 0) {
      cachedVapidKey = wVapid.trim();
      return cachedVapidKey;
    }
  }

  // 3. Runtime fallback from backend API /api/fcm-config
  try {
    const res = await fetch('/api/fcm-config');
    if (res.ok) {
      const data = await res.json();
      if (data.vapidKey && typeof data.vapidKey === 'string' && data.vapidKey.trim().length > 0) {
        cachedVapidKey = data.vapidKey.trim();
        if (typeof window !== 'undefined') {
          (window as any).VAPID_KEY = cachedVapidKey;
        }
        return cachedVapidKey;
      }
    }
  } catch (err) {
    console.warn('[FCM] Notice: Runtime fetch from /api/fcm-config failed:', err);
  }

  return undefined;
}

export const requestFCMToken = async (userId: string, email: string): Promise<FCMRegistrationResult> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn("[FCM] Notification.permission = unsupported");
    return { success: false, error: 'Web Push Notifications are not supported in this browser.', step: 'browser-support' };
  }

  try {
    // 1. Browser permission verification
    let permission = Notification.permission;
    if (permission !== 'granted') {
      console.log("[FCM] Calling Notification.requestPermission()");
      permission = await Notification.requestPermission();
      console.log(`[FCM] Permission result = ${permission}`);
    } else {
      console.log(`[FCM] Permission result = ${permission} (already granted)`);
    }

    if (permission !== 'granted') {
      const errMsg = permission === 'denied' 
        ? 'Notifications are blocked in browser settings.' 
        : 'Notification permission was not granted.';
      console.log(`[FCM] Final status = FAILED (permission ${permission})`);
      return { success: false, error: errMsg, step: 'browser-permission' };
    }

    // 2. Firebase Messaging initialization
    const messaging = await getMessagingInstance();
    if (!messaging) {
      console.error("[FCM] Final status = FAILED (Firebase Messaging initialization failed)");
      return { success: false, error: 'Firebase Messaging is not supported or failed to initialize in this browser.', step: 'firebase-init' };
    }

    // 3. Service worker registration & readiness
    let registration: ServiceWorkerRegistration;
    try {
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      const readyReg = await navigator.serviceWorker.ready;
      if (readyReg) {
        registration = readyReg;
      }
      console.log(`[FCM] Service worker registration = SUCCESS (${registration.scope})`);
    } catch (swErr: any) {
      console.error(`[FCM] Service worker registration = FAILED: ${swErr.message || swErr}`);
      return { 
        success: false, 
        error: `Service worker registration failed: ${swErr.message || swErr}`, 
        step: 'service-worker-reg' 
      };
    }

    // 4. VAPID configuration
    const vapidKey = await getVapidKey();
    const isVapidPresent = !!(vapidKey && typeof vapidKey === 'string' && vapidKey.trim().length > 0);
    console.log(`[FCM] VAPID key available = ${isVapidPresent ? 'YES' : 'NO'}`);

    const getTokenOptions: any = { serviceWorkerRegistration: registration };
    if (isVapidPresent && vapidKey) {
      getTokenOptions.vapidKey = vapidKey;
    }

    // 5. Calling getToken
    console.log("[FCM] getToken = Calling Firebase getToken()...");
    let token = '';
    try {
      token = await getToken(messaging, getTokenOptions);
    } catch (getTokenErr: any) {
      console.error("[FCM] getToken = FAILED:", getTokenErr);
      let userErrMsg = getTokenErr.message || 'Failed to generate FCM Web Push Token';
      if (getTokenErr.code === 'messaging/missing-vapid-key') {
        userErrMsg = 'VAPID public key is missing or not configured for Web Push. Web Push requires VITE_VAPID_KEY.';
      } else if (getTokenErr.code === 'messaging/failed-service-worker-registration') {
        userErrMsg = 'Service worker failed to register FCM token.';
      }
      console.log(`[FCM] Final status = FAILED (${userErrMsg})`);
      return { 
        success: false, 
        error: userErrMsg, 
        code: getTokenErr.code, 
        step: 'getToken' 
      };
    }

    // 6. Token validation
    if (!token || token.trim().length === 0) {
      console.error("[FCM] Token generated = FAILED (empty token)");
      console.log("[FCM] Final status = FAILED (empty token)");
      return { success: false, error: 'Firebase returned an empty notification token.', step: 'getToken' };
    }
    console.log(`[FCM] Token generated = SUCCESS (${token.substring(0, 16)}...)`);

    // 7. Firestore token save & Server API registration
    const { platform, browser, userAgent } = getBrowserInfo();
    const safeTokenId = token.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100);
    const now = Date.now();

    let fsSuccess = false;
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
      fsSuccess = true;
    } catch (fsErr) {
      console.warn("[FCM] Firestore client write notice:", fsErr);
    }

    let serverSuccess = false;
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
      if (regRes.ok && regData.success) {
        serverSuccess = true;
        console.log("[FCM] Backend registration = SUCCESS");
      } else {
        console.warn("[FCM] Backend registration = NOTICE:", regData);
      }
    } catch (serverErr) {
      console.warn("[FCM] Backend registration = ERROR:", serverErr);
    }

    // Save token registered state locally
    localStorage.setItem('fcm_token_registered', 'true');
    console.log("[FCM] Final status = SUCCESS");

    return { 
      success: true, 
      token, 
      step: 'complete',
      details: { firestoreSaved: fsSuccess, backendRegistered: serverSuccess } 
    };
  } catch (err: any) {
    console.error("[FCM] Final status = FAILED:", err);
    return { success: false, error: err.message || 'Unexpected FCM error', step: 'unknown' };
  }
};

export const runFCMDiagnostics = async (
  userId = 'diag_user',
  email = 'diagnostic@laxmiartworks.local'
): Promise<FCMDiagnosticReport> => {
  const report: FCMDiagnosticReport = {
    permission: typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported',
    vapidKeyDetected: false,
    serviceWorkerRegistered: false,
    fcmTokenGenerated: false,
    firestoreSaved: false,
    backendRegistered: false
  };

  console.group('🔧 [FCM DIAGNOSTICS] Starting Comprehensive Check...');

  try {
    // 1. Notification Permission Check
    console.log('1. Notification Permission:', report.permission);
    if (report.permission !== 'granted') {
      if (report.permission === 'default') {
        const perm = await Notification.requestPermission();
        report.permission = perm;
        console.log('   Requested permission, result:', perm);
      }
    }

    // 2. Service Worker Check
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
        report.serviceWorkerRegistered = true;
        report.serviceWorkerScope = reg.scope;
        console.log('2. Service Worker: Registered at scope', reg.scope);
      } catch (swErr: any) {
        console.error('2. Service Worker Registration FAILED:', swErr);
        report.error = 'Service Worker Registration Failed: ' + swErr.message;
        report.stepFailed = 'serviceWorker';
      }
    } else {
      console.error('2. Service Worker: Not supported in this browser environment');
      report.error = 'Service Worker unsupported';
      report.stepFailed = 'serviceWorker';
    }

    // 3. VAPID Key Check
    const vapidKey = await getVapidKey();
    if (vapidKey && vapidKey.trim().length > 0) {
      report.vapidKeyDetected = true;
      report.vapidSource = import.meta.env.VITE_VAPID_KEY ? 'VITE_VAPID_KEY' : '/api/fcm-config';
      console.log(`3. VAPID Key: Detected (${vapidKey.substring(0, 10)}...) from ${report.vapidSource}`);
    } else {
      console.warn('3. VAPID Key: NOT DETECTED (Push subscription may fail if certificate is required)');
    }

    // 4. Token Generation Check
    const regResult = await requestFCMToken(userId, email);
    if (regResult.success && regResult.token) {
      report.fcmTokenGenerated = true;
      report.tokenPreview = regResult.token.substring(0, 20) + '...';
      report.firestoreSaved = regResult.details?.firestoreSaved ?? true;
      report.backendRegistered = regResult.details?.backendRegistered ?? true;
      console.log('4. FCM Token: GENERATED SUCCESS');
      console.log('5. Firestore Token Saved:', report.firestoreSaved ? 'SUCCESS' : 'NOTICE');
      console.log('6. Backend Token Registered:', report.backendRegistered ? 'SUCCESS' : 'NOTICE');
    } else {
      report.error = regResult.error;
      report.stepFailed = regResult.step || 'getToken';
      console.error('4. FCM Token Generation FAILED:', regResult.error);
    }
  } catch (err: any) {
    console.error('FCM Diagnostics Exception:', err);
    report.error = err.message || String(err);
  }

  console.groupEnd();
  console.log('📊 [FCM DIAGNOSTICS REPORT]:', report);
  return report;
};

if (typeof window !== 'undefined') {
  (window as any).__runFCMDiagnostics = runFCMDiagnostics;
}

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
