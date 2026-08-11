const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('AdminAuthProvider')) {
  code = code.replace("import { ProtectedRoute } from \"./lib/auth\";", "import { ProtectedRoute } from \"./lib/auth\";\nimport { AdminAuthProvider } from \"./lib/adminAuth\";");
  code = code.replace("<AdminPanel />", "<AdminAuthProvider>\n            <AdminPanel />\n          </AdminAuthProvider>");
  fs.writeFileSync('src/App.tsx', code);
  console.log("Wrapped AdminPanel with AdminAuthProvider");
}
