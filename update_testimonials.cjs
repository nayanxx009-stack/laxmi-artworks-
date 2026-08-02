const fs = require('fs');
let code = fs.readFileSync('src/components/Testimonials.tsx', 'utf8');

code = code.replace(
  /console\.error\("Failed to fetch reviews via snapshot", err\);/g,
  `if (err.code !== 'unavailable' && !err.message?.includes('offline')) {
        console.error("Failed to fetch reviews via snapshot", err);
      }`
);

fs.writeFileSync('src/components/Testimonials.tsx', code);
