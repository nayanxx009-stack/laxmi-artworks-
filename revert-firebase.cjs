const fs = require('fs');

const genConfig = {
  projectId: "gen-lang-client-0497880119",
  appId: "1:912131930398:web:6511f99f5b59af9845710f",
  apiKey: "AIzaSyDdRsRA_KOCs7kXwSv-RB1EtYeTWgAucic",
  authDomain: "gen-lang-client-0497880119.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-laxmiartworks-323eeacf-ef7f-4ebf-be48-501590306148",
  storageBucket: "gen-lang-client-0497880119.firebasestorage.app",
  messagingSenderId: "912131930398",
  measurementId: "",
  oAuthClientId: "912131930398-erivt37b5otjqkbbtcvruju7a0spgr8t.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

fs.writeFileSync('firebase-applet-config.json', JSON.stringify(genConfig, null, 2));
const configStr = JSON.stringify(genConfig, null, 2);

let firebaseCode = fs.readFileSync('src/lib/firebase.ts', 'utf8');
firebaseCode = firebaseCode.replace(/const firebaseConfig = \{[\s\S]*?\};/, `const firebaseConfig = ${configStr};`);
firebaseCode = firebaseCode.replace(/getFirestore\(app\)/, "getFirestore(app, firebaseConfig.firestoreDatabaseId)");
fs.writeFileSync('src/lib/firebase.ts', firebaseCode);

let serverCode = fs.readFileSync('server.ts', 'utf8');
serverCode = serverCode.replace(/const firebaseConfig = \{[\s\S]*?\};/, `const firebaseConfig = ${configStr};`);
serverCode = serverCode.replace(/getFirestore\(firebaseApp\)/, "getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)");
fs.writeFileSync('server.ts', serverCode);

