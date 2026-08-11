const fs = require('fs');
let code = fs.readFileSync('src/lib/adminAuth.tsx', 'utf8');

code = code.replace("import { db, adminAuth, googleProvider } from './firebase';", "import { adminDb as db, adminAuth, googleProvider } from './firebase';");
fs.writeFileSync('src/lib/adminAuth.tsx', code);
console.log("Updated adminAuth.tsx to use adminDb");
