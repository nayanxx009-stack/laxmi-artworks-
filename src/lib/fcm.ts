import { getToken, deleteToken, onMessage } from "firebase/messaging";
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

export const DEFAULT_VAPID_KEY = "BJUxn7VkzkSVu-gjtAVCPeGZqT4r1xS0whe42rH470rzgZ1ziqAIvST82VJoKjInYOPz_0q0hhF1-jIYCfOFznc";
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

  // 3. Runtime fetch from backend API /api/fcm-config
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

  // 4. Default Project VAPID Public Key
  if (DEFAULT_VAPID_KEY && DEFAULT_VAPID_KEY.trim().length > 0) {
    cachedVapidKey = DEFAULT_VAPID_KEY.trim();
    return cachedVapidKey;
  }

  return undefined;
}

async function ensureServiceWorkerActive(initialReg: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> {
  // If active is already activated, return immediately
  if (initialReg.active && initialReg.active.state === 'activated') {
    return initialReg;
  }

  let reg = initialReg;

  // 1. If navigator.serviceWorker.ready is available, race with a safety timeout
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const readyReg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
      ]);
      if (readyReg) {
        reg = readyReg;
        if (reg.active && reg.active.state === 'activated') {
          return reg;
        }
      }
    } catch (e) {
      // Non-blocking
    }
  }

  // 2. Identify active, waiting, or installing worker
  const worker = reg.active || reg.waiting || reg.installing;
  if (!worker || worker.state === 'activated') {
    return reg;
  }

  // 3. Listen for statechange until activated or redundant
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        try {
          worker.removeEventListener('statechange', handleStateChange);
        } catch (e) {}
        resolve();
      }
    };
    const handleStateChange = () => {
      if (worker.state === 'activated' || worker.state === 'redundant') {
        finish();
      }
    };
    worker.addEventListener('statechange', handleStateChange);
    setTimeout(finish, 4000); // 4 second fallback
  });

  return reg;
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
      if (permission === 'denied') {
        console.warn("[FCM] Permission status = denied");
        return {
          success: false,
          error: 'Notifications are blocked in your browser settings. Please click the lock or site settings icon in your address bar to allow notifications.',
          step: 'permission-denied'
        };
      }
      console.log("[FCM] Calling Notification.requestPermission()");
      try {
        permission = await Notification.requestPermission();
      } catch (permErr: any) {
        console.error("[FCM] Permission request error:", permErr);
        permission = Notification.permission;
      }
      console.log(`[FCM] Permission result = ${permission}`);
    } else {
      console.log(`[FCM] Permission result = ${permission} (already granted)`);
    }

    if (permission !== 'granted') {
      const isDenied = permission === 'denied';
      const errMsg = isDenied 
        ? 'Notifications are blocked in your browser settings. Please allow notifications in site settings or the address bar icon.' 
        : 'Notification permission was not granted. Please click Enable to try again.';
      console.warn(`[FCM] Permission status = ${permission} (${errMsg})`);
      return { 
        success: false, 
        error: errMsg, 
        step: isDenied ? 'permission-denied' : 'permission-default' 
      };
    }

    // 2. Firebase Messaging initialization
    const messaging = await getMessagingInstance();
    if (!messaging) {
      console.error("[FCM] Final status = FAILED (Firebase Messaging initialization failed)");
      return { 
        success: false, 
        error: 'Firebase Messaging could not be initialized in this browser. Please ensure you are browsing over HTTPS or localhost.', 
        step: 'firebase-init' 
      };
    }

    // 3. Service worker registration & readiness
    if (!('serviceWorker' in navigator)) {
      return { 
        success: false, 
        error: 'Service workers are not supported in this browser.', 
        step: 'service-worker-unsupported' 
      };
    }

    let registration: ServiceWorkerRegistration;
    try {
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      console.log(`[FCM] Service worker registered (scope: ${registration.scope})`);
    } catch (swErr: any) {
      console.error(`[FCM] Service worker registration = FAILED:`, swErr);
      return { 
        success: false, 
        error: `Service worker registration failed: ${swErr?.message || swErr}. Ensure the site is served over HTTPS.`, 
        step: 'service-worker-registration' 
      };
    }

    // Ensure service worker is fully active and running before calling getToken
    try {
      registration = await ensureServiceWorkerActive(registration);
      console.log(`[FCM] Service worker registration = SUCCESS and ACTIVE (scope: ${registration.scope}, state: ${registration.active?.state || 'ready'})`);
    } catch (activeErr: any) {
      console.warn(`[FCM] Service worker activation wait notice:`, activeErr);
    }

    // 4. VAPID configuration
    const vapidKey = await getVapidKey();
    if (!vapidKey || typeof vapidKey !== 'string' || vapidKey.trim().length === 0) {
      console.error("[FCM] VAPID Key is missing or invalid");
      return {
        success: false,
        error: 'Web Push credentials (VAPID key) are missing or invalid. Please check configuration.',
        step: 'vapid-key-missing'
      };
    }
    console.log(`[FCM] VAPID key verified (${vapidKey.substring(0, 10)}...)`);

    const getTokenOptions: any = {
      serviceWorkerRegistration: registration,
      vapidKey: vapidKey.trim()
    };

    // 5. Calling getToken with retry loop
    console.log("[FCM] getToken = Calling Firebase getToken()...");
    let token = '';
    let lastGetTokenError: any = null;

    // Retry up to 3 attempts with progressive delay in case worker was finishing activation
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        token = await getToken(messaging, getTokenOptions);
        if (token && token.trim().length > 0) {
          break;
        }
      } catch (err: any) {
        lastGetTokenError = err;
        console.warn(`[FCM] getToken attempt ${attempt} notice:`, err?.code, err?.message || err);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 600 * attempt));
          try {
            const readyReg = await navigator.serviceWorker.ready;
            if (readyReg) {
              getTokenOptions.serviceWorkerRegistration = readyReg;
            }
          } catch (e) {}
        }
      }
    }

    // 6. Token validation
    if (!token || token.trim().length === 0) {
      console.error("[FCM] getToken = FAILED after attempts:", lastGetTokenError);
      const errCode = lastGetTokenError?.code || 'token-generation-failed';
      let userErrMsg = 'Failed to generate notification token on this device. Please try again.';

      if (lastGetTokenError?.message?.includes('no active Service Worker')) {
        userErrMsg = 'The notification service worker is still activating. Please click Enable again.';
      } else if (errCode === 'messaging/missing-vapid-key') {
        userErrMsg = 'VAPID public key is missing or not configured for Web Push.';
      } else if (errCode === 'messaging/failed-service-worker-registration') {
        userErrMsg = 'Service worker failed to register for push notifications.';
      } else if (lastGetTokenError?.message) {
        userErrMsg = `Push registration failed: ${lastGetTokenError.message}`;
      }

      console.log(`[FCM] Final status = FAILED (${userErrMsg})`);
      return { 
        success: false, 
        error: userErrMsg, 
        code: errCode, 
        step: 'token-generation',
        details: lastGetTokenError?.message 
      };
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
    localStorage.setItem('fcm_last_token', token);
    localStorage.setItem('fcm_token_created_at', String(now));
    console.log("[FCM] Final status = SUCCESS");

    return { 
      success: true, 
      token, 
      step: 'complete',
      details: { firestoreSaved: fsSuccess, backendRegistered: serverSuccess, createdAt: now } 
    };
  } catch (err: any) {
    console.error("[FCM] Final status = FAILED:", err);
    return { success: false, error: err.message || 'Unexpected FCM error', step: 'unknown' };
  }
};

export const regenerateFCMToken = async (userId: string, email: string): Promise<FCMRegistrationResult> => {
  console.log('[FCM] Starting clean token regeneration...');
  try {
    const messaging = await getMessagingInstance();
    if (messaging) {
      try {
        await deleteToken(messaging);
        console.log('[FCM] Previous token deleted from Firebase client');
      } catch (delErr) {
        console.warn('[FCM] deleteToken notice:', delErr);
      }
    }
    
    localStorage.removeItem('fcm_token_registered');
    localStorage.removeItem('fcm_last_token');
    localStorage.removeItem('fcm_token_created_at');

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          if (reg.active?.scriptURL.includes('firebase-messaging-sw') || reg.scope.includes('/')) {
            await reg.update();
          }
        }
      } catch (swErr) {
        console.warn('[FCM] SW update notice:', swErr);
      }
    }

    return await requestFCMToken(userId, email);
  } catch (err: any) {
    console.error('[FCM] Error regenerating token:', err);
    return { success: false, error: err.message || 'Failed to regenerate token' };
  }
};

export interface FCMDiagnosticReport {
  origin: string;
  swControllerScriptURL: string | null;
  serviceWorkerRegistered: boolean;
  serviceWorkerScope?: string;
  serviceWorkerActiveScriptURL?: string;
  serviceWorkerControlling: boolean;
  permission: NotificationPermission | 'unsupported';
  fcmTokenGenerated: boolean;
  currentToken?: string;
  tokenPreview?: string;
  tokenCreatedAt?: string;
  projectId: string;
  messagingSenderId: string;
  vapidKeyDetected: boolean;
  vapidSource?: string;
  firestoreSaved: boolean;
  backendRegistered: boolean;
  serverTargetProjectId?: string;
  serverServiceAccountEmail?: string;
  serverRequiredIAMPermission?: string;
  serverRequiredIAMRole?: string;
  serverFcmHttpApiStatus?: string;
  serverIamDiagnosticMessage?: string;
  fcmSendAccepted?: boolean;
  error?: string;
  stepFailed?: string;
}

export const runFCMDiagnostics = async (
  userId = 'diag_user',
  email = 'diagnostic@laxmiartworks.local'
): Promise<FCMDiagnosticReport> => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const swControllerScript = typeof navigator !== 'undefined' && navigator.serviceWorker?.controller
    ? navigator.serviceWorker.controller.scriptURL
    : null;

  const report: FCMDiagnosticReport = {
    origin,
    swControllerScriptURL: swControllerScript,
    permission: typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported',
    vapidKeyDetected: false,
    serviceWorkerRegistered: false,
    serviceWorkerControlling: !!swControllerScript,
    fcmTokenGenerated: false,
    projectId: "laxmi-artworks",
    messagingSenderId: "598865578283",
    firestoreSaved: false,
    backendRegistered: false,
    fcmSendAccepted: false
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
        const readyReg = await navigator.serviceWorker.ready;
        const activeReg = readyReg || reg;
        report.serviceWorkerRegistered = !!activeReg;
        report.serviceWorkerScope = activeReg?.scope;
        report.serviceWorkerActiveScriptURL = activeReg?.active?.scriptURL || activeReg?.installing?.scriptURL || activeReg?.waiting?.scriptURL;
        report.serviceWorkerControlling = !!navigator.serviceWorker.controller;
        report.swControllerScriptURL = navigator.serviceWorker.controller?.scriptURL || null;
        console.log('2. Service Worker: Scope:', report.serviceWorkerScope, '| Active Script:', report.serviceWorkerActiveScriptURL, '| Controller:', report.swControllerScriptURL);
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

    // 4. Token Retrieval Check
    const savedToken = localStorage.getItem('fcm_last_token');
    const tokenTime = localStorage.getItem('fcm_token_created_at');
    if (tokenTime) {
      report.tokenCreatedAt = new Date(parseInt(tokenTime, 10)).toLocaleString();
    }

    if (report.permission === 'granted') {
      const regResult = await requestFCMToken(userId, email);
      if (regResult.success && regResult.token) {
        report.fcmTokenGenerated = true;
        report.currentToken = regResult.token;
        const rawToken = regResult.token;
        report.tokenPreview = rawToken.length > 16 
          ? `${rawToken.substring(0, 8)}...${rawToken.substring(rawToken.length - 6)}` 
          : rawToken;
        report.firestoreSaved = regResult.details?.firestoreSaved ?? true;
        report.backendRegistered = regResult.details?.backendRegistered ?? true;
        if (regResult.details?.createdAt) {
          report.tokenCreatedAt = new Date(regResult.details.createdAt).toLocaleString();
        }
        console.log('4. FCM Token: GENERATED SUCCESS, Preview:', report.tokenPreview);
      } else {
        report.error = regResult.error;
        report.stepFailed = regResult.step || 'getToken';
        if (savedToken) {
          report.currentToken = savedToken;
          report.tokenPreview = `${savedToken.substring(0, 8)}...${savedToken.substring(savedToken.length - 6)}`;
        }
        console.warn('4. FCM Token Generation Notice:', regResult.error);
      }
    } else {
      if (savedToken) {
        report.currentToken = savedToken;
        report.tokenPreview = `${savedToken.substring(0, 8)}...${savedToken.substring(savedToken.length - 6)}`;
      }
      const permMsg = report.permission === 'denied'
        ? 'Notifications are blocked in browser settings. Please allow notifications in site settings or open the app in a new tab.'
        : 'Notification permission has not been granted yet.';
      report.error = permMsg;
      report.stepFailed = 'browser-permission';
      console.warn('4. FCM Token Generation: Skipped (' + permMsg + ')');
    }

    // 5. Server Backend & IAM Diagnostics Check
    try {
      const serverRes = await fetch('/api/admin/fcm-diagnose');
      if (serverRes.ok) {
        const serverData = await serverRes.json();
        report.serverTargetProjectId = serverData.targetProjectId;
        report.serverServiceAccountEmail = serverData.serviceAccountEmail;
        report.serverRequiredIAMPermission = serverData.requiredIAMPermission;
        report.serverRequiredIAMRole = serverData.requiredIAMRole;
        report.serverFcmHttpApiStatus = serverData.fcmHttpApiStatus;
        report.serverIamDiagnosticMessage = serverData.iamDiagnosticMessage;
        report.fcmSendAccepted = serverData.fcmHttpApiStatus === 'fcm_api_authorized_and_ready';
        console.log('5. Server Backend FCM IAM Status:', serverData);
      }
    } catch (serverErr) {
      console.warn('Could not query /api/admin/fcm-diagnose:', serverErr);
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
