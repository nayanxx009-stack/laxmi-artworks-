const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

code = code.replace(
  /\(error\) => console\.error\(error\)/g,
  `(error) => { if (error.code !== 'unavailable' && !error.message?.includes('offline')) console.error(error); }`
);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
