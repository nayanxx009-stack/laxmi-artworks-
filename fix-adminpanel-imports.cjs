const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

code = code.replace("import { useAuth } from '../lib/auth';", "import { useAdminAuth } from '../lib/adminAuth';\nimport { useAuth } from '../lib/auth';");
code = code.replace("import { auth, googleProvider, db, storage } from '../lib/firebase';", "import { auth, googleProvider, adminDb as db, adminStorage as storage } from '../lib/firebase';");

// Replace useAuth destructured vars with useAdminAuth
code = code.replace("const { user, role, logout, loginWithGoogle } = useAuth();", "const { adminUser: user, adminRole: role, logoutAdmin: logout, loginAdminWithGoogle: loginWithGoogle } = useAdminAuth();");

fs.writeFileSync('src/components/AdminPanel.tsx', code);
console.log("Updated AdminPanel imports and hooks");
