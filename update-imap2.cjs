const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldStr = `    try {
      await client.connect();
    } catch (err) {
      console.log("[Payment Verifier] Waiting for valid IMAP credentials to be configured...");
      for (const order of pendingOrders) {
         if (order.paymentStatus === 'Pending Verification' || order.paymentStatus === 'Payment Submitted' || order.paymentStatus === 'Pending Payment') {
            await updateDoc(doc(db, 'orders', order.id), {
               paymentVerificationNote: "IMAP Authentication Pending. Please check App Password in settings.",
               paymentStatus: 'Pending Verification'
            });
         }
      }
      isCheckingEmails = false;
      return;
    }
    let lock = await client.getMailboxLock('INBOX');
    try {`;

const newStr = `    try {
      console.log(\`[Payment Verifier] Connecting to IMAP server \${imapConfig.host}...\`);
      await client.connect();
      console.log(\`[Payment Verifier] Connection result: SUCCESS\`);
      console.log(\`[Payment Verifier] Authentication result: SUCCESS for \${imapConfig.auth.user}\`);
    } catch (err) {
      const errorMsg = err.response || err.responseText || err.message || "Unknown IMAP error";
      console.log(\`[Payment Verifier] Connection/Authentication result: FAILED\`);
      console.log(\`[Payment Verifier] Exact server response: \${errorMsg}\`);
      for (const order of pendingOrders) {
         if (order.paymentStatus === 'Pending Verification' || order.paymentStatus === 'Payment Submitted' || order.paymentStatus === 'Pending Payment') {
            await updateDoc(doc(db, 'orders', order.id), {
               paymentVerificationNote: \`IMAP Error: \${errorMsg}\`,
               paymentStatus: 'Pending Verification'
            });
         }
      }
      isCheckingEmails = false;
      return;
    }

    let lock;
    try {
      lock = await client.getMailboxLock('INBOX');
      console.log(\`[Payment Verifier] Inbox access result: SUCCESS\`);
    } catch (err) {
      const errorMsg = err.response || err.responseText || err.message || "Unknown IMAP error";
      console.log(\`[Payment Verifier] Inbox access result: FAILED\`);
      console.log(\`[Payment Verifier] Exact server response: \${errorMsg}\`);
      for (const order of pendingOrders) {
         if (order.paymentStatus === 'Pending Verification' || order.paymentStatus === 'Payment Submitted' || order.paymentStatus === 'Pending Payment') {
            await updateDoc(doc(db, 'orders', order.id), {
               paymentVerificationNote: \`IMAP Inbox Error: \${errorMsg}\`,
               paymentStatus: 'Pending Verification'
            });
         }
      }
      await client.logout();
      isCheckingEmails = false;
      return;
    }

    try {`;

if (code.includes(oldStr)) {
  console.log("Found target!");
  code = code.replace(oldStr, newStr);
  fs.writeFileSync('server.ts', code);
} else {
  console.log("Target not found!");
}
