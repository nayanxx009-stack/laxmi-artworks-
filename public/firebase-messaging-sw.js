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

function notifyClients(type, data) {
  try {
    if (swBroadcastChannel) {
      swBroadcastChannel.postMessage({ type, data, timestamp: Date.now() });
    }
  } catch (e) {}
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
    windowClients.forEach(client => {
      client.postMessage({ type, data, timestamp: Date.now() });
    });
  }).catch(() => {});
}

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[FCM-SW] BACKGROUND MESSAGE RECEIVED', payload);
  notifyClients('BACKGROUND_MESSAGE_RECEIVED', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'Laxmi Artworks';
  const origin = (self.location && self.location.origin) ? self.location.origin : '';
  const defaultIcon = origin ? (origin + '/icon-192.png') : '/icon-192.png';
  const defaultBadge = origin ? (origin + '/icon-192.png') : '/icon-192.png';

  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new update from Laxmi Artworks',
    icon: payload.notification?.icon || payload.data?.icon || defaultIcon,
    badge: payload.notification?.badge || payload.data?.badge || defaultBadge,
    tag: payload.data?.tag || ('laxmi-push-' + Date.now()),
    renotify: true,
    data: {
      url: payload.data?.url || payload.data?.click_action || payload.fcmOptions?.link || '/'
    }
  };

  console.log('[FCM-SW] SHOWING NOTIFICATION', notificationTitle);
  return self.registration.showNotification(notificationTitle, notificationOptions).then(() => {
    console.log('[FCM-SW] NOTIFICATION DISPLAYED', notificationTitle);
    notifyClients('NOTIFICATION_DISPLAY_ATTEMPTED', { success: true, title: notificationTitle });
  }).catch((err) => {
    console.error('[FCM-SW] NOTIFICATION DISPLAY ERROR', err);
    notifyClients('NOTIFICATION_DISPLAY_ATTEMPTED', { success: false, error: err.message });
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
