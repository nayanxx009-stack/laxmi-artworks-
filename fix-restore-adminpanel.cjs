const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

code = code.replace("import { useAdminAuth } from '../lib/adminAuth';\nimport { useAuth } from '../lib/auth';", "import { useAuth } from '../lib/auth';");
code = code.replace("import { auth, googleProvider, adminDb as db, adminStorage as storage } from '../lib/firebase';", "import { auth, googleProvider, db, storage } from '../lib/firebase';");
code = code.replace("const { adminUser: user, adminRole: role, logoutAdmin: logout, loginWithGoogle } = useAdminAuth();", "const { user, role, logout, loginWithGoogle } = useAuth();");

fs.writeFileSync('src/components/AdminPanel.tsx', code);
console.log("Restored AdminPanel.tsx");
