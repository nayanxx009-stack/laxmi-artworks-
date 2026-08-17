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
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const swBroadcastChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('laxmi_fcm_sw_channel') : null;

function notifyClients(type, payloadData) {
  const messageData = { type, ...payloadData, timestamp: Date.now() };
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

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const diagnosticId = payload.data?.diagnosticId || payload.diagnosticId || '';
  console.log('[FCM-SW] BACKGROUND MESSAGE RECEIVED', { diagnosticId, payload });
  
  // Notify client apps that SW received message
  notifyClients('FCM_SW_MESSAGE_RECEIVED', {
    diagnosticId,
    payload,
    title: payload.notification?.title || payload.data?.title || 'Laxmi Artworks'
  });

  const notificationTitle = payload.notification?.title || payload.data?.title || 'Laxmi Artworks';
  const origin = (self.location && self.location.origin) ? self.location.origin : '';
  const defaultIcon = origin ? (origin + '/icon-192.png') : '/icon-192.png';
  const defaultBadge = origin ? (origin + '/icon-192.png') : '/icon-192.png';

  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new update from Laxmi Artworks',
    icon: payload.notification?.icon || payload.data?.icon || defaultIcon,
    badge: payload.notification?.badge || payload.data?.badge || defaultBadge,
    tag: payload.data?.tag || ('laxmi-push-' + (diagnosticId || Date.now())),
    renotify: true,
    data: {
      diagnosticId,
      url: payload.data?.url || payload.data?.click_action || payload.fcmOptions?.link || '/'
    }
  };

  console.log('[FCM-SW] SHOWING NOTIFICATION', { diagnosticId, notificationTitle });
  return self.registration.showNotification(notificationTitle, notificationOptions).then(() => {
    console.log('[FCM-SW] NOTIFICATION DISPLAYED', { diagnosticId, notificationTitle });
    notifyClients('FCM_SW_NOTIFICATION_SHOWN', {
      diagnosticId,
      title: notificationTitle,
      success: true
    });
  }).catch((err) => {
    console.error('[FCM-SW] NOTIFICATION DISPLAY ERROR', { diagnosticId, error: err.message });
    notifyClients('FCM_SW_NOTIFICATION_SHOWN', {
      diagnosticId,
      title: notificationTitle,
      success: false,
      error: err.message
    });
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url: urlToOpen });
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
