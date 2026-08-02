const fs = require('fs');
let code = fs.readFileSync('src/components/Gallery.tsx', 'utf8');

code = code.replace(
  /console\.error\("Error fetching gallery:", err\);/g,
  `if (err.code !== 'unavailable' && !err.message?.includes('offline')) {
        console.error("Error fetching gallery:", err);
      }`
);

fs.writeFileSync('src/components/Gallery.tsx', code);
