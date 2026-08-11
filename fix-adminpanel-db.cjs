const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

code = code.replace(
  "import { auth, googleProvider, db, storage } from '../lib/firebase';",
  "import { auth, googleProvider, adminDb as db, adminStorage as storage } from '../lib/firebase';"
);
fs.writeFileSync('src/components/AdminPanel.tsx', code);
console.log("Updated AdminPanel to use adminDb and adminStorage");
