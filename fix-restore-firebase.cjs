const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf8');

code = code.replace("const adminApp = initializeApp(firebaseConfig, 'adminApp');export const adminAuth = getAuth(adminApp);export const adminDb = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);export const adminStorage = getStorage(adminApp);", "");
fs.writeFileSync('src/lib/firebase.ts', code);
console.log("Restored firebase.ts");
