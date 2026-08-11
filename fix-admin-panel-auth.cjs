const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

// Replace useAuth with useAdminAuth
code = code.replace("import { useAuth } from '../lib/auth';", "import { useAdminAuth } from '../lib/adminAuth';\nimport { useAuth } from '../lib/auth';");
code = code.replace("const { user, role, logout, loginWithGoogle } = useAuth();", "const { adminUser: user, adminRole: role, logoutAdmin: logout, loginWithGoogle } = useAdminAuth();");

fs.writeFileSync('src/components/AdminPanel.tsx', code);
console.log("Updated AdminPanel to use useAdminAuth");
