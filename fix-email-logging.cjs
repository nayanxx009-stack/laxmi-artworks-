const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

const origEndpoint = `    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: user,
          pass: pass
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 15000
      });`;

const replEndpoint = `    try {
      console.log(\`[INVOICE] Request received for \${email}\`);
      console.log(\`[INVOICE] Customer email validated\`);
      console.log(\`[INVOICE] Preparing email\`);
      
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: user,
          pass: pass
        },
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 15000
      });
      
      console.log(\`[INVOICE] Connecting to email service...\`);
      
      // Verify transporter before sending
      await transporter.verify().catch(err => {
        console.error(\`[INVOICE] FAILED verification: \`, err.message);
        throw new Error('Email service authentication or connection failed. Check credentials.');
      });`;

if (serverCode.includes(origEndpoint)) {
   serverCode = serverCode.replace(origEndpoint, replEndpoint);
}

const origSend = `      await transporter.sendMail(mailOptions);
      res.json({ success: true });
    } catch (err: any) {
      console.error('Invoice send error:', err);
      res.status(500).json({ success: false, error: err.message || 'SMTP Connection failed or rejected.' });
    }`;

const replSend = `      console.log(\`[INVOICE] Sending email to \${email}...\`);
      const info = await transporter.sendMail(mailOptions);
      console.log(\`[INVOICE] Email provider responded: \${info.messageId}\`);
      console.log(\`[INVOICE] Completed\`);
      
      res.json({ success: true });
    } catch (err: any) {
      console.error('[INVOICE] FAILED:', err.message);
      res.status(500).json({ success: false, error: err.message || 'SMTP Connection failed or rejected.' });
    }`;

if (serverCode.includes(origSend)) {
   serverCode = serverCode.replace(origSend, replSend);
}

fs.writeFileSync('server.ts', serverCode);
console.log('Fixed email logging');
