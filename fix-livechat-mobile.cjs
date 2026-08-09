const fs = require('fs');
let code = fs.readFileSync('src/components/LiveChat.tsx', 'utf8');

code = code.replace(
  /useEffect\(\(\) => \{\n    if \(isOpen && notificationStatus === 'default' && typeof Notification !== 'undefined'\) \{\n       const hasPrompted = localStorage\.getItem\('fcm_prompted'\);\n       if \(!hasPrompted\) \{\n          localStorage\.setItem\('fcm_prompted', 'true'\);\n          \/\/ Wait a bit after opening chat to ask\n          setTimeout\(\(\) => \{\n            handleRequestNotifications\(true\);\n          \}, 2000\);\n       \}\n    \}\n  \}, \[isOpen, notificationStatus\]\);/,
  `// Removed automatic prompt to comply with mobile browser policies requiring user gestures`
);

fs.writeFileSync('src/components/LiveChat.tsx', code);
