const fs = require('fs');

const files = ['src/components/AdminPanel.tsx', 'src/lib/auth.tsx'];

for (const f of files) {
  let code = fs.readFileSync(f, 'utf8');
  code = code.replace(/const MASTER_ADMINS = \["gargsubhalaxmi@gmail\.com", "nayanxx009@gmail\.com", "admin@example\.com"\];/g, 'const MASTER_ADMINS = ["gargsubhalaxmi@gmail.com", "nayanxx009@gmail.com", "bolt36520@gmail.com", "admin@example.com"];');
  fs.writeFileSync(f, code);
}
