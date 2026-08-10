const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

const origTry = `    try {
      console.log(\`[INVOICE] Request received for \${email}\`);`;

const replTry = `    try {
      console.log(\`[INVOICE] Request received for \${email}\`);
      console.log(\`[EMAIL CONFIG]\`);
      console.log(\`runtime: server\`);
      console.log(\`GMAIL_USER: \${process.env.GMAIL_USER ? 'PRESENT' : 'MISSING'}\`);
      console.log(\`GMAIL_APP_PASSWORD: \${process.env.GMAIL_APP_PASSWORD ? 'PRESENT' : 'MISSING'}\`);
      
      if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
          throw new Error('Email server credentials not configured (GMAIL_USER or GMAIL_APP_PASSWORD missing).');
      }
      `;

if (serverCode.includes(origTry)) {
   serverCode = serverCode.replace(origTry, replTry);
}

// Remove the early check that causes 500 without logs
const earlyCheck = `    const user = process.env.GMAIL_USER || process.env.IMAP_USER;
    const pass = process.env.GMAIL_APP_PASSWORD || process.env.IMAP_PASS;
    
    if (!user || !pass) {
       return res.status(500).json({ success: false, error: 'Email server credentials not configured.' });
    }`;

if (serverCode.includes(earlyCheck)) {
   serverCode = serverCode.replace(earlyCheck, '');
}

fs.writeFileSync('server.ts', serverCode);
console.log('Fixed diagnostics');
