importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCY2OXKl8QB-4-YqHNiLWRVcLXwn-xP-mY",
  authDomain: "laxmi-artworks.firebaseapp.com",
  projectId: "laxmi-artworks",
  storageBucket: "laxmi-artworks.firebasestorage.app",
  messagingSenderId: "598865578283",
  appId: "1:598865578283:web:edb8d8eb2eef1c9129dd6e"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Laxmi Artworks Update';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new update from Laxmi Artworks',
    icon: payload.notification?.icon || '/vite.svg',
    badge: '/vite.svg',
    data: {
      url: payload.data?.url || payload.fcmOptions?.link || '/'
    }
  };

  // If payload does not have a standard 'notification' object, show manual notification:
  if (!payload.notification) {
    self.registration.showNotification(notificationTitle, notificationOptions);
  }
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
