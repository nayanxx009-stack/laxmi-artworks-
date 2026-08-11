const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf8');

if (!code.includes('adminDb')) {
  code = code.replace(
    "export const adminAuth = getAuth(adminApp);",
    "export const adminAuth = getAuth(adminApp);\nexport const adminDb = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);\nexport const adminStorage = getStorage(adminApp);"
  );
  fs.writeFileSync('src/lib/firebase.ts', code);
  console.log("Added adminDb and adminStorage");
} else {
  console.log("adminDb already present");
}
