import 'dotenv/config';
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import path from "path";
import { createServer as createViteServer } from "vite";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp as initAdmin, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore, query, collection, where, getDocs, updateDoc, doc } from 'firebase/firestore';


// Initialize Firebase Admin if Service Account is provided
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    initAdmin({ credential: cert(serviceAccount) });
    console.log('[Server] Firebase Admin initialized for FCM.');
  } catch (e) {
    console.error('[Server] Failed to initialize Firebase Admin:', e.message);
  }
}

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
  host: 'imap.gmail.com',
  port: parseInt(process.env.IMAP_PORT || '993', 10),
  secure: true,
  auth: {
    user: process.env.IMAP_USER || '',
    pass: (process.env.IMAP_PASS || '').replace(/\s+/g, '')
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
               paymentVerificationNote: "IMAP credentials not configured in backend",
               paymentStatus: 'Pending Verification'
            });
         }
      }
      isCheckingEmails = false;
      return;
    }

    console.log(`[Payment Verifier] Found ${pendingOrders.length} pending orders. Connecting to IMAP...`);

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
      console.log(`[Payment Verifier] Connecting to IMAP server ${imapConfig.host}...`);
      await client.connect();
      console.log(`[Payment Verifier] Connection result: SUCCESS`);
      console.log(`[Payment Verifier] Authentication result: SUCCESS for ${imapConfig.auth.user}`);
    } catch (err) {
      const errorMsg = err.response || err.responseText || err.message || "Unknown IMAP error";
      console.log(`[Payment Verifier] Connection/Authentication result: FAILED`);
      console.log(`[Payment Verifier] Exact server response: ${errorMsg}`);
      for (const order of pendingOrders) {
         if (order.paymentStatus === 'Pending Verification' || order.paymentStatus === 'Payment Submitted' || order.paymentStatus === 'Pending Payment') {
            await updateDoc(doc(db, 'orders', order.id), {
               paymentVerificationNote: `IMAP Error: ${errorMsg}`,
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
      console.log(`[Payment Verifier] Inbox access result: SUCCESS`);
    } catch (err) {
      const errorMsg = err.response || err.responseText || err.message || "Unknown IMAP error";
      console.log(`[Payment Verifier] Inbox access result: FAILED`);
      console.log(`[Payment Verifier] Exact server response: ${errorMsg}`);
      for (const order of pendingOrders) {
         if (order.paymentStatus === 'Pending Verification' || order.paymentStatus === 'Payment Submitted' || order.paymentStatus === 'Pending Payment') {
            await updateDoc(doc(db, 'orders', order.id), {
               paymentVerificationNote: `IMAP Inbox Error: ${errorMsg}`,
               paymentStatus: 'Pending Verification'
            });
         }
      }
      await client.logout();
      isCheckingEmails = false;
      return;
    }

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
           
           // Skip our own inquiry notification emails
           if (parsed.subject?.includes('New Commission Inquiry')) continue;
           
           if (fullText.includes(order.orderId.toUpperCase())) {
             matchingEmails.push(parsed);
           }
        }
        
        if (matchingEmails.length === 1) {
           const parsed = matchingEmails[0];
           const fullText = (parsed.subject + " " + parsed.text).toUpperCase();
           
           // Extract UTR/Transaction ID if possible (usually 12 digits for UPI)
           const utrMatch = fullText.match(/\b\d{12}\b/);
           const utr = utrMatch ? utrMatch[0] : null;
           
           if (fullText.includes(String(order.amount))) {
              console.log(`[Payment Verifier] Verified payment for ${order.orderId}`);
              await updateDoc(doc(db, 'orders', order.id), {
                status: 'Drafting & Concept', // advance status automatically
                paymentStatus: 'Paid',
                transactionReference: utr || parsed.messageId || 'IMAP-VERIFIED',
                paymentVerificationNote: `Auto Verified (IMAP) - Sender: ${parsed.from?.text || 'Unknown'}`
              });
           } else {
              await updateDoc(doc(db, 'orders', order.id), {
                paymentStatus: 'Pending Verification',
                paymentVerificationNote: `Email found but amount mismatch (Expected: ${order.amount})`
              });
           }
        } else if (matchingEmails.length > 1) {
           await updateDoc(doc(db, 'orders', order.id), {
             paymentStatus: 'Pending Verification',
             paymentVerificationNote: `Multiple emails matched Order ID ${order.orderId}. Manual verification required.`
           });
        } else {
           // No emails matched yet
           if (order.paymentStatus !== 'Pending Verification') {
               await updateDoc(doc(db, 'orders', order.id), {
                 paymentVerificationNote: `Waiting for payment email in Inbox...`
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
  isCheckingEmails = false;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Send Push Notification via FCM
  app.post("/api/send-push", async (req, res) => {
    const { token, title, body, url } = req.body;
    if (!getApps().length) {
      return res.status(500).json({ error: 'Firebase Admin not configured' });
    }
    try {
      const message = {
        token,
        notification: { title, body },
        data: { url: url || '/' }
      };
      await getMessaging().send(message);
      res.json({ success: true });
    } catch (err) {
      console.error('FCM Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Broadcast Push Notification
  app.post("/api/broadcast-push", async (req, res) => {
    const { tokens, title, body, url } = req.body;
    if (!getApps().length) {
      return res.status(500).json({ error: 'Firebase Admin not configured' });
    }
    try {
      const message = {
        tokens,
        notification: { title, body },
        data: { url: url || '/' }
      };
      const response = await getMessaging().sendEachForMulticast(message);
      res.json({ success: true, response });
    } catch (err) {
      console.error('FCM Broadcast Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  
  app.post("/api/send-invoice", async (req, res) => {
    const { email, order, pdfBase64 } = req.body;
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
       return res.status(500).json({ success: false, error: 'Email credentials not configured' });
    }
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD
        }
      });
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: `Invoice for Order ${order.id}`,
        text: `Dear ${order.name},

Please find attached the invoice for your order ${order.id}.

Thank you,
Laxmi Artworks`,
        attachments: [
          {
            filename: `Invoice_${order.id}.pdf`,
            content: pdfBase64.split("base64,")[1],
            encoding: 'base64'
          }
        ]
      };
      await transporter.sendMail(mailOptions);
      res.json({ success: true });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/notify-shipment", async (req, res) => {
    const { email, orderId, courierPartner, trackingId, estimatedDelivery, status } = req.body;
    
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
       return res.status(500).json({ success: false, error: 'Email credentials not configured' });
    }
    
    try {
       const transporter = nodemailer.createTransport({
         service: 'gmail',
         auth: {
           user: process.env.GMAIL_USER,
           pass: process.env.GMAIL_APP_PASSWORD
         }
       });

       const mailOptions = {
         from: process.env.GMAIL_USER,
         to: email,
         subject: `Shipment Update for Order ${orderId}`,
         text: `Your order ${orderId} shipment status has been updated to: ${status}.\n\nCourier: ${courierPartner}\nTracking ID: ${trackingId}\nEstimated Delivery: ${estimatedDelivery || 'N/A'}\n\nYou can track your order using the provided tracking ID.`
       };

       await transporter.sendMail(mailOptions);
       res.json({ success: true });
    } catch (err: any) {
       console.error("Email error:", err);
       res.status(500).json({ success: false, error: err.message });
    }
  });

  // Authenticate server
  const auth = getAuth(firebaseApp);
  try {
    await signInWithEmailAndPassword(auth, 'server@laxmiartworks.local', 'ServerSecure123!');
    console.log('[Server] Authenticated to Firebase successfully.');
  } catch (err) {
    console.log('[Server] User not found, creating server user...');
    try {
      
      await createUserWithEmailAndPassword(auth, 'server@laxmiartworks.local', 'ServerSecure123!');
      console.log('[Server] Created and authenticated server user successfully.');
    } catch (createErr) {
      console.error('[Server] Failed to authenticate to Firebase:', createErr.message);
    }
  }

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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
