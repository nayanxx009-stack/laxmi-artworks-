const fs = require('fs');

const content = `import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { initializeApp } from 'firebase/app';
import { getFirestore, query, collection, where, getDocs, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  "projectId": "laxmi-artworks",
  "appId": "1:598865578283:web:edb8d8eb2eef1c9129dd6e",
  "apiKey": "AIzaSyCY2OXKl8QB-4-YqHNiLWRVcLXwn-xP-mY",
  "authDomain": "laxmi-artworks.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-laxmiartworks-323eeacf-ef7f-4ebf-be48-501590306148",
  "storageBucket": "laxmi-artworks.firebasestorage.app",
  "messagingSenderId": "598865578283",
  "measurementId": "",
  "oAuthClientId": "",
  "recaptchaSiteKey": ""
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const imapConfig = {
  host: process.env.IMAP_HOST || 'imap.gmail.com',
  port: parseInt(process.env.IMAP_PORT || '993', 10),
  secure: true,
  auth: {
    user: process.env.IMAP_USER || '',
    pass: process.env.IMAP_PASS || ''
  }
};

let isCheckingEmails = false;

async function verifyPaymentsBackground() {
  if (isCheckingEmails) return;
  isCheckingEmails = true;
  
  try {
    const q = query(collection(db, 'orders'), where('paymentStatus', 'in', ['Pending Payment', 'Payment Submitted', 'Pending Verification']));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      isCheckingEmails = false;
      return;
    }
    
    const pendingOrders = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
    
    if (!imapConfig.auth.user || !imapConfig.auth.pass) {
      for (const order of pendingOrders) {
         if (!order.paymentVerificationNote) {
            await updateDoc(doc(db, 'orders', order.id), {
               paymentVerificationNote: "IMAP credentials not configured in backend"
            });
         }
      }
      isCheckingEmails = false;
      return;
    }

    console.log(\`[Payment Verifier] Found \${pendingOrders.length} pending orders. Connecting to IMAP...\`);

    const client = new ImapFlow({
      host: imapConfig.host,
      port: imapConfig.port,
      secure: imapConfig.secure,
      auth: imapConfig.auth,
      logger: false
    });

    await client.connect();
    let lock = await client.getMailboxLock('INBOX');
    try {
      const d = new Date();
      d.setDate(d.getDate() - 3); // check last 3 days
      
      const messages = [];
      for await (let msg of client.fetch({ since: d }, { source: true, envelope: true })) {
        messages.push(msg);
      }
      
      for (const order of pendingOrders) {
        if (!order.orderId) continue;
        
        let matchingEmails = [];
        
        for (const msg of messages) {
           const parsed = await simpleParser(msg.source);
           const fullText = (parsed.subject + " " + parsed.text).toUpperCase();
           if (fullText.includes(order.orderId.toUpperCase())) {
             matchingEmails.push(parsed);
           }
        }
        
        if (matchingEmails.length === 1) {
           const parsed = matchingEmails[0];
           const fullText = (parsed.subject + " " + parsed.text).toUpperCase();
           
           // Extract UTR/Transaction ID if possible (usually 12 digits for UPI)
           const utrMatch = fullText.match(/\\b\\d{12}\\b/);
           const utr = utrMatch ? utrMatch[0] : null;
           
           if (fullText.includes(String(order.amount))) {
              console.log(\`[Payment Verifier] Verified payment for \${order.orderId}\`);
              await updateDoc(doc(db, 'orders', order.id), {
                status: 'Drafting & Concept', // advance status automatically
                paymentStatus: 'Paid',
                transactionReference: utr || parsed.messageId || 'IMAP-VERIFIED',
                paymentVerificationNote: \`Auto Verified (IMAP) - Sender: \${parsed.from?.text || 'Unknown'}\`
              });
           } else {
              await updateDoc(doc(db, 'orders', order.id), {
                paymentStatus: 'Pending Verification',
                paymentVerificationNote: \`Email found but amount mismatch (Expected: \${order.amount})\`
              });
           }
        } else if (matchingEmails.length > 1) {
           await updateDoc(doc(db, 'orders', order.id), {
             paymentStatus: 'Pending Verification',
             paymentVerificationNote: \`Multiple emails matched Order ID \${order.orderId}. Manual verification required.\`
           });
        } else {
           // No emails matched yet
           if (order.paymentStatus !== 'Pending Verification') {
               await updateDoc(doc(db, 'orders', order.id), {
                 paymentVerificationNote: \`Waiting for payment email in Inbox...\`
               });
           }
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (error) {
    console.error("[Payment Verifier] Error:", error);
  }
  isCheckingEmails = false;
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Start background task
  verifyPaymentsBackground();
  setInterval(verifyPaymentsBackground, 30000); // Check every 30s

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(\`Server running on http://localhost:\${PORT}\`);
  });
}

startServer();
`;

fs.writeFileSync('server.ts', content);
