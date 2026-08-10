const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const orig = `      console.log(\`GMAIL_USER: \${process.env.GMAIL_USER ? 'PRESENT' : 'MISSING'}\`);
      console.log(\`GMAIL_APP_PASSWORD: \${process.env.GMAIL_APP_PASSWORD ? 'PRESENT' : 'MISSING'}\`);
      
      if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
          throw new Error('Email server credentials not configured (GMAIL_USER or GMAIL_APP_PASSWORD missing).');
      }`;

const repl = `      console.log(\`GMAIL_USER: \${process.env.GMAIL_USER ? 'PRESENT' : 'MISSING'}\`);
      console.log(\`GMAIL_APP_PASSWORD: \${process.env.GMAIL_APP_PASSWORD ? 'PRESENT' : 'MISSING'}\`);
      
      const user = process.env.GMAIL_USER || process.env.IMAP_USER;
      const pass = process.env.GMAIL_APP_PASSWORD || process.env.IMAP_PASS;
      
      if (!user || !pass) {
          throw new Error('Email server credentials not configured (GMAIL_USER or GMAIL_APP_PASSWORD missing).');
      }`;

code = code.replace(orig, repl);
fs.writeFileSync('server.ts', code);
console.log('Fixed user/pass variables');
