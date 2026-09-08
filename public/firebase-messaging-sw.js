// Laxmi Artworks FCM Service Worker
// Version: 2.2.0 - Full Background & Foreground Web Push Handler
const SW_VERSION = '2.2.0';

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

if (!firebase.apps || !firebase.apps.length) {
  firebase.initializeApp({
    apiKey: "AIzaSyCY2OXKl8QB-4-YqHNiLWRVcLXwn-xP-mY",
    authDomain: "laxmi-artworks.firebaseapp.com",
    projectId: "laxmi-artworks",
    storageBucket: "laxmi-artworks.firebasestorage.app",
    messagingSenderId: "598865578283",
    appId: "1:598865578283:web:edb8d8eb2eef1c9129dd6e"
  });
}

self.addEventListener('install', (event) => {
  console.log(`[FCM-SW] Installed version ${SW_VERSION}`);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log(`[FCM-SW] Activated version ${SW_VERSION}`);
  event.waitUntil(self.clients.claim());
});

const swBroadcastChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('laxmi_fcm_sw_channel') : null;

function notifyClients(type, payloadData) {
  const messageData = { type, ...payloadData, swVersion: SW_VERSION, timestamp: Date.now() };
  try {
    if (swBroadcastChannel) {
      swBroadcastChannel.postMessage(messageData);
    }
  } catch (e) {}
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
    windowClients.forEach(client => {
      client.postMessage(messageData);
    });
  }).catch(() => {});
}

// 1. Raw W3C Push Event Handler (Ensures all push events are intercepted regardless of window visibility)
self.addEventListener('push', (event) => {
  console.log(`[FCM-SW ${SW_VERSION}] Push event received at:`, new Date().toISOString());

  let rawPayload = {};
  if (event.data) {
    try {
      rawPayload = event.data.json();
    } catch (jsonErr) {
      try {
        rawPayload = { data: { body: event.data.text() } };
      } catch (textErr) {
        rawPayload = {};
      }
    }
  }

  const dataPayload = rawPayload.data || {};
  const notifPayload = rawPayload.notification || {};
  const diagnosticId = dataPayload.diagnosticId || rawPayload.diagnosticId || '';
  const title = notifPayload.title || dataPayload.title || 'Laxmi Artworks';
  const body = notifPayload.body || dataPayload.body || 'You have a new update from Laxmi Artworks';
  const url = dataPayload.url || dataPayload.click_action || rawPayload.fcmOptions?.link || '/';

  // Broadcast STAGE 3: Service Worker Receives Background Push Event
  notifyClients('FCM_SW_MESSAGE_RECEIVED', {
    diagnosticId,
    payload: rawPayload,
    title,
    body,
    url
  });

  const origin = (self.location && self.location.origin) ? self.location.origin : '';
  const defaultIcon = origin ? (origin + '/icon-192.png') : '/icon-192.png';
  const defaultBadge = origin ? (origin + '/icon-192.png') : '/icon-192.png';

  const notificationOptions = {
    body,
    icon: notifPayload.icon || dataPayload.icon || defaultIcon,
    badge: notifPayload.badge || dataPayload.badge || defaultBadge,
    tag: dataPayload.tag || ('laxmi-push-' + (diagnosticId || Date.now())),
    renotify: true,
    requireInteraction: false,
    data: {
      diagnosticId,
      url,
      timestamp: Date.now()
    }
  };

  // Check window clients visibility & show notification
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const hasVisibleClient = windowClients.some(c => c.visibilityState === 'visible');
      console.log(`[FCM-SW] Window clients found: ${windowClients.length}, Has visible: ${hasVisibleClient}`);

      // Always display system notification unless already rendered, ensuring Stage 4 confirmation
      return self.registration.showNotification(title, notificationOptions).then(() => {
        console.log(`[FCM-SW] STAGE 4 Notification displayed successfully [${diagnosticId || 'none'}]`);
        notifyClients('FCM_SW_NOTIFICATION_SHOWN', {
          diagnosticId,
          title,
          success: true,
          hasVisibleClient
        });
      }).catch((err) => {
        console.error(`[FCM-SW] STAGE 4 Notification display error [${diagnosticId || 'none'}]:`, err);
        notifyClients('FCM_SW_NOTIFICATION_SHOWN', {
          diagnosticId,
          title,
          success: false,
          error: err.message,
          hasVisibleClient
        });
      });
    })
  );
});

// 2. Firebase compat background message handler (Fallback & complementary)
try {
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const diagnosticId = payload.data?.diagnosticId || payload.diagnosticId || '';
    console.log('[FCM-SW] Firebase onBackgroundMessage received:', { diagnosticId, payload });
    
    notifyClients('FCM_SW_MESSAGE_RECEIVED', {
      diagnosticId,
      payload,
      title: payload.notification?.title || payload.data?.title || 'Laxmi Artworks'
    });
  });
} catch (e) {
  console.warn('[FCM-SW] Firebase messaging init in SW notice:', e);
}

// 3. Notification Click Handler (STAGE 5 & STAGE 6)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const urlToOpen = notifData.url || '/';
  const diagnosticId = notifData.diagnosticId || '';

  console.log(`[FCM-SW] STAGE 5 Notification clicked [${diagnosticId}]. Target URL: ${urlToOpen}`);

  // Broadcast STAGE 5 (Notification Click Received)
  notifyClients('FCM_SW_NOTIFICATION_CLICKED', {
    diagnosticId,
    url: urlToOpen,
    action: event.action || 'default'
  });

  // Navigate or focus window (STAGE 6: Correct production URL opened)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url: urlToOpen, diagnosticId });
          notifyClients('FCM_SW_URL_OPENED', { diagnosticId, url: urlToOpen, mode: 'focused_existing' });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen).then(() => {
          notifyClients('FCM_SW_URL_OPENED', { diagnosticId, url: urlToOpen, mode: 'opened_new_window' });
        });
      }
    })
  );
});

// 4. Message event handler for SW Ping & Diagnostics
self.addEventListener('message', (event) => {
  if (event.data?.type === 'PING_SW') {
    const reply = {
      type: 'PONG_SW',
      version: SW_VERSION,
      scope: self.registration.scope,
      active: true,
      origin: self.location.origin,
      timestamp: Date.now()
    };
    if (event.source && 'postMessage' in event.source) {
      event.source.postMessage(reply);
    }
    notifyClients('PONG_SW', reply);
  } else if (event.data?.type === 'TEST_SW_NOTIFICATION') {
    const title = event.data.title || 'Laxmi Artworks Test';
    const options = {
      body: event.data.body || 'Testing Service Worker notification display directly from SW context.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'test-' + Date.now(),
      data: { url: event.data.url || '/' }
    };
    self.registration.showNotification(title, options).then(() => {
      notifyClients('FCM_SW_NOTIFICATION_SHOWN', { success: true, title, isManualTest: true });
    }).catch(err => {
      notifyClients('FCM_SW_NOTIFICATION_SHOWN', { success: false, error: err.message, isManualTest: true });
    });
  }
});
