const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf8');

if (!code.includes('adminApp')) {
  code = code.replace(
    "export const auth = getAuth(app);",
    "export const auth = getAuth(app);\nconst adminApp = initializeApp(firebaseConfig, 'adminApp');\nexport const adminAuth = getAuth(adminApp);"
  );
  fs.writeFileSync('src/lib/firebase.ts', code);
  console.log("Added adminAuth to firebase.ts");
}
