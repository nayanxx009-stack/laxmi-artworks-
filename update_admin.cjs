const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

code = code.replace(
  /Please add GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN to your environment variables\./g,
  "Please add GMAIL_USER and GMAIL_APP_PASSWORD to your environment variables."
);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
