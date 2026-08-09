const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

code = code.replace(
  /useEffect\(\(\) => \{\n\s*if \(user && role === 'admin'\) \{\n\s*const MASTER_ADMINS/g,
  `useEffect(() => {
    if (user && role === 'admin') {
      const MASTER_ADMINS`
);

code = code.replace(
  /setCheckingAuth\(false\);\n\s*\}\n\s*\}, \[user, role\]\);/g,
  `setCheckingAuth(false);
    } else {
      setIsAdmin(false);
      setIsOwner(false);
    }
  }, [user, role]);`
);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
