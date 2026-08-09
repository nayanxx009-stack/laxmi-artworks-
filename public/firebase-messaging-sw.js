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
  // FCM automatically shows a system notification if the payload contains a 'notification' object.
  // We do NOT call self.registration.showNotification here if it's a notification payload, to avoid duplicates.
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      if (windowClients.length > 0) {
        let client = windowClients[0];
        client.focus();
        client.postMessage({ type: 'NAVIGATE', url: urlToOpen });
      } else {
        clients.openWindow(urlToOpen);
      }
    })
  );
});
