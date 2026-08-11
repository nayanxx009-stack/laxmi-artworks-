const fs = require('fs');

// 1. Remove adminAuth context from App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace("import { AdminAuthProvider } from \"./lib/adminAuth\";\n", "");
appCode = appCode.replace("<AdminAuthProvider>\n            <AdminPanel />\n          </AdminAuthProvider>", "<AdminPanel />");
fs.writeFileSync('src/App.tsx', appCode);

// 2. Fix AdminPanel imports and logout behavior
let adminCode = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');
adminCode = adminCode.replace("import { useAdminAuth } from '../lib/adminAuth';\n", "");
adminCode = adminCode.replace("const { adminUser: user, adminRole: role, logoutAdmin: logout, loginAdminWithGoogle: loginWithGoogle } = useAdminAuth();", "const { user, role, logout: realLogout, loginWithGoogle } = useAuth();\n  const logout = () => {\n    // Just redirect to lock the admin panel without signing out of Firebase\n    window.location.href = '/';\n  };");
adminCode = adminCode.replace("import { auth, googleProvider, adminDb as db, adminStorage as storage } from '../lib/firebase';", "import { auth, googleProvider, db, storage } from '../lib/firebase';");
// Remove the realLogout call from password reset if it exists
adminCode = adminCode.replace("await logout();\n      window.location.reload();", "window.location.href = '/';");
fs.writeFileSync('src/components/AdminPanel.tsx', adminCode);

// 3. Revert Admin components db usage
const components = ['src/components/AdminBackup.tsx', 'src/components/AdminChat.tsx', 'src/components/AdminInquiries.tsx', 'src/components/AdminNotifications.tsx'];
for (const file of components) {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace("import { adminDb as db } from '../lib/firebase';", "import { db } from '../lib/firebase';");
  fs.writeFileSync(file, code);
}
console.log("Fixed all!");
