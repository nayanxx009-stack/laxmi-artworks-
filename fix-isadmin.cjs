const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

code = code.replace(/const \[isAdmin, setIsAdmin\] = useState\(true\);/, 'const [isAdmin, setIsAdmin] = useState(false);');

fs.writeFileSync('src/components/AdminPanel.tsx', code);
