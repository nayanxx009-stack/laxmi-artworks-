const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /if \(\!process\.env\.GMAIL_USER \|\| \!process\.env\.GMAIL_APP_PASSWORD\) \{/,
  `if (!process.env.IMAP_USER || !process.env.IMAP_PASS) {`
);

code = code.replace(
  /user: process\.env\.GMAIL_USER,\n\s*pass: process\.env\.GMAIL_APP_PASSWORD/,
  `user: process.env.IMAP_USER,
          pass: process.env.IMAP_PASS`
);

code = code.replace(
  /from: process\.env\.GMAIL_USER,/,
  `from: process.env.IMAP_USER,`
);

fs.writeFileSync('server.ts', code);
