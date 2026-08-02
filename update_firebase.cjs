const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf8');
code = code.replace(/initializeFirestore\(app, {\s*experimentalForceLongPolling: true\s*}\)/, 'getFirestore(app)');
code = code.replace(/import { initializeFirestore } from 'firebase\/firestore';/, 'import { getFirestore } from "firebase/firestore";');
fs.writeFileSync('src/lib/firebase.ts', code);
