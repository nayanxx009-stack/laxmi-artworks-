const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetFuncStart = `async function verifyPaymentsBackground() {`;
const targetFuncEndRegex = /async function startServer\(\) \{/;

// Find the start index
const startIndex = code.indexOf(targetFuncStart);
// Find the end index
const match = code.match(targetFuncEndRegex);
const endIndex = match ? match.index : -1;

if (startIndex !== -1 && endIndex !== -1) {
  const newFunc = `async function verifyPaymentsBackground() {
  if (isCheckingEmails) return;
  isCheckingEmails = true;
  
  try {
    const q = query(collection(db, 'payments'), where('verificationStatus', 'in', ['Pending', 'Waiting For Payment', 'Verifying']));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      isCheckingEmails = false;
      return;
    }
    
    const pendingPayments = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
    
    if (!imapConfig.auth.user || !imapConfig.auth.pass) {
      for (const pay of pendingPayments) {
         if (!pay.verificationNote) {
            await updateDoc(doc(db, 'payments', pay.id), {
               verificationNote: "IMAP credentials not configured in backend",
               verificationStatus: 'Failed'
            });
         }
      }
      isCheckingEmails = false;
      return;
    }

    console.log(\`[Payment Verifier] Found \${pendingPayments.length} pending payments. Connecting to IMAP...\`);

    const client = new ImapFlow({
      host: imapConfig.host,
      port: imapConfig.port,
      secure: imapConfig.secure,
      auth: imapConfig.auth,
      logger: false
    });

    client.on('error', (err) => {
      console.log("[Payment Verifier] IMAP Client Error:", err.message);
    });

    try {
      await client.connect();
    } catch (err) {
      const errorMsg = err.response || err.responseText || err.message || "Unknown IMAP error";
      for (const pay of pendingPayments) {
         if (pay.verificationStatus !== 'Failed') {
            await updateDoc(doc(db, 'payments', pay.id), {
               verificationNote: \`IMAP Inbox Error: \${errorMsg}\`,
               verificationStatus: 'Failed'
            });
         }
      }
      await client.logout();
      isCheckingEmails = false;
      return;
    }

    try {
      const lock = await client.getMailboxLock('INBOX');
      try {
        const d = new Date();
        d.setDate(d.getDate() - 3);
        
        const messages = [];
        for await (let msg of client.fetch({ since: d }, { source: true, envelope: true })) {
          messages.push(msg);
        }
        
        for (const pay of pendingPayments) {
          if (!pay.orderId) continue;

          let matchingEmails = [];
          
          for (const msg of messages) {
             const parsed = await simpleParser(msg.source);
             const fullText = (parsed.subject + " " + parsed.text).toUpperCase();
             
             if (parsed.subject?.includes('New Commission Inquiry')) continue;
             
             if (fullText.includes(pay.orderId.toUpperCase()) || (pay.manualUTR && fullText.includes(pay.manualUTR))) {
               matchingEmails.push(parsed);
             }
          }
          
          if (matchingEmails.length > 0) {
             const parsed = matchingEmails[0];
             const fullText = (parsed.subject + " " + parsed.text).toUpperCase();
             
             const utrMatch = fullText.match(/\\b\\d{12}\\b/);
             const utr = utrMatch ? utrMatch[0] : null;
             
             if (fullText.includes(String(pay.amount)) || pay.manualUTR) {
                console.log(\`[Payment Verifier] Verified payment for \${pay.orderId}\`);
                
                await updateDoc(doc(db, 'payments', pay.id), {
                  verificationStatus: 'Paid',
                  transactionId: utr || pay.manualUTR || parsed.messageId || 'IMAP-VERIFIED',
                  verificationNote: \`Auto Verified (IMAP) - Sender: \${parsed.from?.text || 'Unknown'}\`
                });

                const orderData = {
                  orderId: pay.orderId,
                  userId: pay.formData.userId || 'guest',
                  name: pay.formData.name || 'Unknown',
                  email: pay.formData.email || 'unknown@example.com',
                  phone: pay.formData.phone || '0000000000',
                  message: pay.formData.message || '',
                  amount: pay.amount,
                  paymentStatus: 'Paid',
                  status: 'Drafting & Concept',
                  transactionReference: utr || pay.manualUTR || parsed.messageId || 'IMAP-VERIFIED',
                  createdAt: Date.now()
                };
                
                await setDoc(doc(db, 'orders', pay.orderId), orderData);

                await updateDoc(doc(db, 'payments', pay.id), {
                  verificationStatus: 'Order Confirmed'
                });
             } else {
                await updateDoc(doc(db, 'payments', pay.id), {
                  verificationStatus: 'Failed',
                  verificationNote: \`Email found but amount mismatch (Expected: \${pay.amount})\`
                });
             }
          } else {
             if (Date.now() - pay.timestamp > 15 * 60 * 1000) {
               await updateDoc(doc(db, 'payments', pay.id), {
                 verificationStatus: 'Failed',
                 verificationNote: \`Timeout waiting for payment email.\`
               });
             } else if (pay.verificationStatus !== 'Verifying' && pay.verificationStatus !== 'Waiting For Payment') {
               await updateDoc(doc(db, 'payments', pay.id), {
                 verificationNote: \`Waiting for payment email in Inbox...\`
               });
             }
          }
        }
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (error) {
      console.log("[Payment Verifier] Verification paused:", error.message);
    }
  } catch (error) {
    console.error("[Payment Verifier] Global error:", error);
  }
  isCheckingEmails = false;
}

`;

  const finalCode = code.slice(0, startIndex) + newFunc + code.slice(endIndex);
  fs.writeFileSync('server.ts', finalCode);
  console.log('Successfully updated verifyPaymentsBackground in server.ts');
} else {
  console.log('Failed to find function bounds in server.ts');
}
