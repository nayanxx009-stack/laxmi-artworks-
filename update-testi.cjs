const fs = require('fs');
let code = fs.readFileSync('src/components/Testimonials.tsx', 'utf8');
code = code.replace(
  `setReviews(data.filter(r => r.status?.toLowerCase() === 'approved' || r.status === 'Approved'));`,
  `setReviews(data.filter(r => r.status?.toLowerCase() === 'approved'));`
);
// Actually, earlier the user's issue was: "Do not filter reviews only by current user."
fs.writeFileSync('src/components/Testimonials.tsx', code);
