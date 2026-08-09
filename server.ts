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
import { getFirestore, query, collection, where, getDocs, updateDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';


// Initialize Firebase Admin
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    initAdmin({ credential: cert(serviceAccount) });
    console.log('[Server] Firebase Admin initialized for FCM with service account.');
  } else {
    initAdmin({ projectId: "laxmi-artworks" });
    console.log('[Server] Firebase Admin initialized for FCM with ADC.');
  }
} catch (e) {
  console.error('[Server] Failed to initialize Firebase Admin:', e.message);
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

    console.log(`[Payment Verifier] Found ${pendingPayments.length} pending payments. Connecting to IMAP...`);

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
               verificationNote: `IMAP Inbox Error: ${errorMsg}`,
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
             
             const utrMatch = fullText.match(/\b\d{12}\b/);
             const utr = utrMatch ? utrMatch[0] : null;
             
             if (fullText.includes(String(pay.amount)) || pay.manualUTR) {
                console.log(`[Payment Verifier] Verified payment for ${pay.orderId}`);
                
                await updateDoc(doc(db, 'payments', pay.id), {
                  verificationStatus: 'Paid',
                  transactionId: utr || pay.manualUTR || parsed.messageId || 'IMAP-VERIFIED',
                  verificationNote: `Auto Verified (IMAP) - Sender: ${parsed.from?.text || 'Unknown'}`
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
                  verificationNote: `Email found but amount mismatch (Expected: ${pay.amount})`
                });
             }
          } else {
             if (Date.now() - pay.timestamp > 15 * 60 * 1000) {
               await updateDoc(doc(db, 'payments', pay.id), {
                 verificationStatus: 'Failed',
                 verificationNote: `Timeout waiting for payment email.`
               });
             } else if (pay.verificationStatus !== 'Verifying' && pay.verificationStatus !== 'Waiting For Payment') {
               await updateDoc(doc(db, 'payments', pay.id), {
                 verificationNote: `Waiting for payment email in Inbox...`
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

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Send Push Notification via FCM
  app.post("/api/send-push", async (req, res) => {
    const { token, title, body, url, userId } = req.body;
    console.log(`[Push API] Attempting to send push to token: ${token?.substring(0, 10)}...`);
    if (!getApps().length) {
      console.error('[Push API] Firebase Admin not configured.');
      return res.status(500).json({ error: 'Firebase Admin not configured' });
    }
    if (!token) {
      console.error('[Push API] Missing token.');
      return res.status(400).json({ error: 'Missing token' });
    }
    try {
      const message = {
        token,
        notification: { title, body },
        data: { url: url || '/' }
      };
      const response = await getMessaging().send(message);
      console.log(`[Push API] Successfully sent message: ${response}`);
      res.json({ success: true, messageId: response });
    } catch (err) {
      console.error('[Push API] FCM Error:', err.message);
      
      // Remove invalid token from Firestore
      if (err.code === 'messaging/invalid-registration-token' || 
          err.code === 'messaging/registration-token-not-registered') {
        console.log(`[Push API] Token is invalid or expired. Removing token: ${token}`);
        try {
          // Find which document has this token and remove it
          const fcmTokensRef = collection(db, 'fcm_tokens');
          const snapshot = await getDocs(fcmTokensRef);
          snapshot.forEach(async (docSnap) => {
            const data = docSnap.data();
            if (data.tokens && data.tokens.includes(token)) {
               const newTokens = data.tokens.filter(t => t !== token);
               await updateDoc(doc(db, 'fcm_tokens', docSnap.id), { tokens: newTokens });
            } else if (data.token === token) {
               await deleteDoc(doc(db, 'fcm_tokens', docSnap.id));
            }
          });
        } catch(delErr) {
          console.error('[Push API] Failed to delete token:', delErr);
        }
      }
      
      res.status(500).json({ error: err.message, code: err.code });
    }
  });
  // Broadcast Push Notification
  app.post("/api/broadcast-push", async (req, res) => {
    const { tokens, title, body, url } = req.body;
    console.log(`[Push API] Attempting to broadcast to ${tokens?.length || 0} tokens`);
    
    if (!getApps().length) {
      console.error('[Push API] Firebase Admin not configured.');
      return res.status(500).json({ error: 'Firebase Admin not configured' });
    }
    
    if (!tokens || !tokens.length) {
      console.error('[Push API] Missing tokens.');
      return res.status(400).json({ error: 'Missing tokens' });
    }
    
    try {
      const message = {
        tokens,
        notification: { title, body },
        data: { url: url || '/' }
      };
      const response = await getMessaging().sendEachForMulticast(message);
      
      console.log(`[Push API] Broadcast success count: ${response.successCount}, failure count: ${response.failureCount}`);
      
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
             console.error(`[Push API] Failed to send to token ${tokens[idx]}: ${resp.error?.message}`);
          }
        });
      }
      
      res.json({ success: true, response });
    } catch (err) {
      console.error('[Push API] FCM Broadcast Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });
  
  app.post("/api/send-invoice", async (req, res) => {
    const { email, order, pdfBase64 } = req.body;
    if (!process.env.IMAP_USER || !process.env.IMAP_PASS) {
       return res.status(500).json({ success: false, error: 'Email credentials not configured' });
    }
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.IMAP_USER,
          pass: process.env.IMAP_PASS
        }
      });
      const mailOptions = {
        from: process.env.IMAP_USER,
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
