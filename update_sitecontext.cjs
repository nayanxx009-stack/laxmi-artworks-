const fs = require('fs');
let code = fs.readFileSync('src/lib/SiteContext.tsx', 'utf8');

code = code.replace(
  /console\.error\("Failed to load site config via snapshot:", error\);/,
  `if (error.code !== 'unavailable' && !error.message?.includes('offline')) {
        console.error("Failed to load site config via snapshot:", error);
      }`
);

fs.writeFileSync('src/lib/SiteContext.tsx', code);
