const fs = require('fs');
let code = fs.readFileSync('src/components/InquiryStatusModal.tsx', 'utf8');

code = code.replace(
  /console\.error\("Failed to load live inquiries", err\);/g,
  `if (err.code !== 'unavailable' && !err.message?.includes('offline')) {
        console.error("Failed to load live inquiries", err);
      }`
);

fs.writeFileSync('src/components/InquiryStatusModal.tsx', code);
