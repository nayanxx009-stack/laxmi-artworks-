const fs = require('fs');
let code = fs.readFileSync('src/lib/fcm.ts', 'utf8');

code = code.replace(
  /export const onForegroundMessage = \(\) => \{[\s\S]*?\};/,
  `export const onForegroundMessage = (callback: (payload: any) => void) => {
  if (!messaging) return null;
  return onMessage(messaging, callback);
};`
);

fs.writeFileSync('src/lib/fcm.ts', code);
