const fs = require('fs');
let code = fs.readFileSync('src/lib/auth.tsx', 'utf8');

code = code.replace(
  /currentRole = data\.role \|\| \(MASTER_ADMINS\.includes\(u\.email\?\.toLowerCase\(\) \|\| ''\) \? 'admin' : 'user'\);/g,
  `currentRole = MASTER_ADMINS.includes(u.email?.toLowerCase() || '') ? 'admin' : (data.role || 'user');`
);

fs.writeFileSync('src/lib/auth.tsx', code);
