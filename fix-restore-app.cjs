const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace("import { ProtectedRoute } from \"./lib/auth\";\nimport { AdminAuthProvider } from \"./lib/adminAuth\";", "import { ProtectedRoute } from \"./lib/auth\";");
code = code.replace("<AdminAuthProvider>\n            <AdminPanel />\n          </AdminAuthProvider>", "<AdminPanel />");

fs.writeFileSync('src/App.tsx', code);
console.log("Restored App.tsx");
