const fs = require('fs');
let code = fs.readFileSync('public/firebase-messaging-sw.js', 'utf8');

code = code.replace(
  /messaging\.onBackgroundMessage\(\(payload\) => \{[\s\S]*?\}\);/,
  `messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // FCM automatically shows a system notification if the payload contains a 'notification' object.
  // We do NOT call self.registration.showNotification here if it's a notification payload, to avoid duplicates.
});`
);

fs.writeFileSync('public/firebase-messaging-sw.js', code);
