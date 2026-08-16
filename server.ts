import 'dotenv/config';
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp as initAdmin, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore, query, collection, where, getDocs, getDoc, updateDoc, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';


// Initialize Firebase Admin
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    const targetProjectId = serviceAccount.project_id || "laxmi-artworks";
    initAdmin({
      credential: cert(serviceAccount),
      projectId: targetProjectId
    });
    console.log(`[Server] Firebase Admin initialized for project "${targetProjectId}" with service account "${serviceAccount.client_email}".`);
  } else {
    initAdmin({ projectId: "laxmi-artworks" });
    console.log('[Server] Firebase Admin initialized for project "laxmi-artworks" with ADC.');
  }
} catch (e: any) {
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
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Routes
  
  app.get("/api/debug-env", (req, res) => {
    res.json({
      hasUser: !!process.env.GMAIL_USER,
      hasPass: !!process.env.GMAIL_APP_PASSWORD,
      userVal: process.env.GMAIL_USER ? process.env.GMAIL_USER.substring(0, 3) + '...' : 'none'
    });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Helper to send push to user across multi-device tokens and legacy tokens
  async function sendPushToUserServer(userId: string, email: string, title: string, body: string, url: string = '/') {
    if (!getApps().length) return;
    try {
      const tokens = new Set<string>();

      // 1. Check users/{userId}/notificationTokens
      if (userId && userId !== 'guest') {
        try {
          const subCol = await getDocs(collection(db, 'users', userId, 'notificationTokens'));
          subCol.forEach(d => {
            const data = d.data();
            if (data.token && data.enabled !== false) tokens.add(data.token);
          });
        } catch (e) { /* ignore */ }
      }

      // 2. Check fcm_tokens doc by userId
      if (userId) {
        try {
          const fcmDoc = await getDocs(query(collection(db, 'fcm_tokens'), where('userId', '==', userId)));
          fcmDoc.forEach(d => {
            const data = d.data();
            if (data.tokens && Array.isArray(data.tokens)) data.tokens.forEach((t: string) => tokens.add(t));
            else if (data.token) tokens.add(data.token);
          });
        } catch (e) { /* ignore */ }
      }

      // 3. Check fcm_tokens doc by email
      if (email) {
        try {
          const fcmDocEmail = await getDocs(query(collection(db, 'fcm_tokens'), where('email', '==', email.toLowerCase())));
          fcmDocEmail.forEach(d => {
            const data = d.data();
            if (data.tokens && Array.isArray(data.tokens)) data.tokens.forEach((t: string) => tokens.add(t));
            else if (data.token) tokens.add(data.token);
          });
        } catch (e) { /* ignore */ }
      }

      const tokenList = Array.from(tokens);
      if (tokenList.length > 0) {
        console.log(`[Push Watcher] Sending push notification to ${tokenList.length} token(s) for user ${userId || email}: "${title}"`);
        const response = await getMessaging().sendEachForMulticast({
          tokens: tokenList,
          notification: { title, body },
          data: { url: url || '/' }
        });
        console.log(`[Push Watcher] Success: ${response.successCount}, Failures: ${response.failureCount}`);
      } else {
        console.log(`[Push Watcher] No FCM tokens found for user ${userId || email}`);
      }
    } catch (err: any) {
      console.error('[Push Watcher] Error sending push to user:', err.message);
    }
  }

  // Real-time Order Watcher for automatic notifications
  const knownOrderStatuses = new Map<string, { status: string; paymentStatus: string }>();
  let isInitialOrderWatcherLoad = true;

  function startOrderWatcher() {
    try {
      const ordersCol = collection(db, 'orders');
      onSnapshot(ordersCol, (snapshot) => {
        if (isInitialOrderWatcherLoad) {
          snapshot.docs.forEach(d => {
            const data = d.data();
            knownOrderStatuses.set(d.id, {
              status: data.status || '',
              paymentStatus: data.paymentStatus || ''
            });
          });
          isInitialOrderWatcherLoad = false;
          console.log(`[Order Watcher] Initialized watcher with ${knownOrderStatuses.size} existing orders.`);
          return;
        }

        snapshot.docChanges().forEach(async (change) => {
          const orderId = change.doc.id;
          const data = change.doc.data();
          const prev = knownOrderStatuses.get(orderId);

          if (change.type === 'added' && !prev) {
            knownOrderStatuses.set(orderId, {
              status: data.status || '',
              paymentStatus: data.paymentStatus || ''
            });
            console.log(`[Order Watcher] New order created: #${orderId}`);
            await sendPushToUserServer(
              data.userId,
              data.email,
              'Order Placed 🎨',
              `Your Laxmi Artworks order #${orderId} has been placed successfully.`,
              `/?orderId=${orderId}`
            );
            if (data.paymentStatus === 'Paid' || data.paymentStatus === 'Verified') {
              await sendPushToUserServer(
                data.userId,
                data.email,
                'Payment Confirmed ✓',
                `Payment for order #${orderId} has been confirmed.`,
                `/?orderId=${orderId}`
              );
            }
          } else if (change.type === 'modified') {
            const newStatus = data.status || '';
            const newPaymentStatus = data.paymentStatus || '';
            const oldStatus = prev?.status || '';
            const oldPaymentStatus = prev?.paymentStatus || '';

            knownOrderStatuses.set(orderId, { status: newStatus, paymentStatus: newPaymentStatus });

            // Status Transition
            if (newStatus && newStatus !== oldStatus) {
              console.log(`[Order Watcher] Status changed for #${orderId}: "${oldStatus}" -> "${newStatus}"`);
              const statusUpper = newStatus.toUpperCase();
              let title = '';
              let body = '';

              if (statusUpper.includes('DRAFT') || statusUpper.includes('SKETCH') || statusUpper.includes('PAINTING') || statusUpper.includes('PROCESSING')) {
                title = 'Order Processing 🎨';
                body = `Your artwork for order #${orderId} is now being prepared.`;
              } else if (statusUpper.includes('REVIEW') || statusUpper.includes('PACKAGING') || statusUpper.includes('READY')) {
                title = 'Your Artwork Is Ready ✨';
                body = `Your artwork for order #${orderId} is ready!`;
              } else if (statusUpper.includes('SHIPPED') || statusUpper.includes('TRANSIT') || statusUpper.includes('DISPATCHED')) {
                title = 'Order Shipped 📦';
                body = `Your order #${orderId} has been shipped.`;
              } else if (statusUpper.includes('OUT FOR DELIVERY')) {
                title = 'Out for Delivery 🚚';
                body = `Your order #${orderId} is out for delivery!`;
              } else if (statusUpper.includes('DELIVERED')) {
                title = 'Order Delivered 🎉';
                body = `Your order #${orderId} has been delivered. Thank you!`;
              } else if (statusUpper.includes('CANCEL')) {
                title = 'Order Cancelled ❌';
                body = `Your order #${orderId} has been cancelled.`;
              } else {
                title = 'Order Status Updated 🎨';
                body = `Your order #${orderId} status has been updated to: ${newStatus}`;
              }

              await sendPushToUserServer(data.userId, data.email, title, body, `/?orderId=${orderId}`);
            }

            // Payment Status Transition
            if (newPaymentStatus && newPaymentStatus !== oldPaymentStatus) {
              console.log(`[Order Watcher] Payment status changed for #${orderId}: "${oldPaymentStatus}" -> "${newPaymentStatus}"`);
              const pUpper = newPaymentStatus.toUpperCase();
              if (pUpper === 'PAID' || pUpper === 'VERIFIED') {
                await sendPushToUserServer(
                  data.userId,
                  data.email,
                  'Payment Confirmed ✓',
                  `Payment for order #${orderId} has been confirmed.`,
                  `/?orderId=${orderId}`
                );
              } else if (pUpper === 'FAILED') {
                await sendPushToUserServer(
                  data.userId,
                  data.email,
                  'Payment Failed ❌',
                  `We couldn't confirm the payment for order #${orderId}. Please check payment details.`,
                  `/?orderId=${orderId}`
                );
              }
            }
          }
        });
      }, (err) => {
        console.error('[Order Watcher] Firestore error:', err);
      });
    } catch (err: any) {
      console.error('[Order Watcher] Failed to start order watcher:', err.message);
    }
  }

  // Explicit route for Firebase Service Worker
  app.get("/firebase-messaging-sw.js", (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const swPathProd = path.join(process.cwd(), 'dist', 'firebase-messaging-sw.js');
    const swPathDev = path.join(process.cwd(), 'public', 'firebase-messaging-sw.js');
    const swPath = fs.existsSync(swPathProd) ? swPathProd : swPathDev;
    if (fs.existsSync(swPath)) {
      res.sendFile(swPath);
    } else {
      res.status(404).send('// Service worker file not found');
    }
  });

  // Expose public runtime FCM configuration and public VAPID key
  app.get("/api/fcm-config", (req, res) => {
    const vapidKey = process.env.VITE_VAPID_KEY || process.env.VAPID_KEY || process.env.FIREBASE_VAPID_KEY || '';
    res.json({
      success: true,
      projectId: "laxmi-artworks",
      messagingSenderId: "598865578283",
      appId: "1:598865578283:web:edb8d8eb2eef1c9129dd6e",
      vapidKey: vapidKey.trim()
    });
  });

  // Register FCM Token via Server API
  app.post("/api/register-fcm-token", async (req, res) => {
    const { userId, email, token, platform, browser, userAgent } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Missing token' });
    }
    const targetUserId = userId || 'guest_' + Math.random().toString(36).substring(2, 9);
    const targetEmail = (email || 'guest@laxmiartworks.local').toLowerCase();
    const safeTokenId = token.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100);
    const now = Date.now();

    try {
      // 1. Save in users/{userId}/notificationTokens/{safeTokenId}
      const userTokenDocRef = doc(db, 'users', targetUserId, 'notificationTokens', safeTokenId);
      let createdAt = now;
      try {
        const existingDocSnap = await getDoc(userTokenDocRef);
        if (existingDocSnap.exists()) {
          createdAt = existingDocSnap.data().createdAt || now;
        }
      } catch (readErr) {
        // Continue with now
      }

      await setDoc(userTokenDocRef, {
        token,
        userId: targetUserId,
        email: targetEmail,
        createdAt,
        updatedAt: now,
        lastSeenAt: now,
        platform: platform || 'Desktop',
        browser: browser || 'Unknown',
        userAgent: userAgent || '',
        enabled: true
      }, { merge: true });

      // 2. Save in fcm_tokens/{userId}
      try {
        const fcmDocRef = doc(db, 'fcm_tokens', targetUserId);
        let tokens = [token];
        try {
          const docSnap = await getDoc(fcmDocRef);
          if (docSnap.exists()) {
            const existingData = docSnap.data();
            if (existingData.tokens && Array.isArray(existingData.tokens)) {
              if (!existingData.tokens.includes(token)) {
                tokens = [...existingData.tokens, token];
              } else {
                tokens = existingData.tokens;
              }
            } else if (existingData.token && existingData.token !== token) {
              tokens = [existingData.token, token];
            }
          }
        } catch (fcmReadErr) {
          // Continue with [token]
        }
        await setDoc(fcmDocRef, {
          tokens,
          token,
          userId: targetUserId,
          email: targetEmail,
          updatedAt: now
        }, { merge: true });
      } catch (fcmErr) {
        console.warn('[Register FCM] fcm_tokens write notice:', fcmErr);
      }

      // 3. Auto-subscribe to all_users topic
      if (getApps().length) {
        try {
          await getMessaging().subscribeToTopic([token], 'all_users');
        } catch (subErr: any) {
          console.warn('[Register FCM] Topic subscribe notice:', subErr.message);
        }
      }

      console.log(`[Register FCM] Successfully registered token for user ${targetUserId}`);
      res.json({ success: true, userId: targetUserId, tokenId: safeTokenId });
    } catch (err: any) {
      console.error('[Register FCM] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin FCM Stats
  app.get("/api/admin/fcm-stats", async (req, res) => {
    try {
      const tokenMap = new Map<string, any>();

      // Read from fcm_tokens
      try {
        const fcmSnap = await getDocs(collection(db, 'fcm_tokens'));
        fcmSnap.forEach(d => {
          const data = d.data();
          if (data.tokens && Array.isArray(data.tokens)) {
            data.tokens.forEach((t: string) => {
              if (t && !tokenMap.has(t)) {
                tokenMap.set(t, { token: t, userId: data.userId || d.id, email: data.email || '' });
              }
            });
          } else if (data.token && !tokenMap.has(data.token)) {
            tokenMap.set(data.token, { token: data.token, userId: data.userId || d.id, email: data.email || '' });
          }
        });
      } catch (e: any) {
        console.warn('[Admin FCM Stats] fcm_tokens read notice:', e.message);
      }

      // Read from users/*/notificationTokens
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        for (const uDoc of usersSnap.docs) {
          try {
            const subSnap = await getDocs(collection(db, 'users', uDoc.id, 'notificationTokens'));
            subSnap.forEach(tDoc => {
              const data = tDoc.data();
              if (data.token && data.enabled !== false && !tokenMap.has(data.token)) {
                tokenMap.set(data.token, {
                  token: data.token,
                  userId: data.userId || uDoc.id,
                  email: data.email || '',
                  platform: data.platform || 'Desktop',
                  browser: data.browser || 'Unknown'
                });
              }
            });
          } catch (subErr) { /* ignore */ }
        }
      } catch (e: any) {
        console.warn('[Admin FCM Stats] users subcollection read notice:', e.message);
      }

      const devices = Array.from(tokenMap.values());
      res.json({ success: true, count: devices.length, devices });
    } catch (err: any) {
      console.error('[Admin FCM Stats] Error:', err.message);
      res.status(500).json({ error: err.message, count: 0, devices: [] });
    }
  });

  // Admin FCM Diagnostics Endpoint (Real backend state reflection)
  app.get("/api/admin/fcm-diagnose", async (req, res) => {
    try {
      const isInitialized = getApps().length > 0;
      let saInfo: any = null;
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        try {
          const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          saInfo = {
            client_email: parsed.client_email,
            project_id: parsed.project_id,
            type: parsed.type
          };
        } catch (e) {
          saInfo = { parseError: 'Failed to parse JSON' };
        }
      }

      let fcmHttpApiStatus = 'unknown';
      let iamDiagnosticMessage = '';
      let testError: any = null;

      if (isInitialized) {
        try {
          // Attempt dryRun send with a test message to inspect real FCM HTTP v1 API & IAM status
          await getMessaging().send({
            token: 'test_probe_token_for_iam_verification',
            notification: { title: 'IAM Diagnostic Probe', body: 'Testing' }
          }, true);
          fcmHttpApiStatus = 'accessible';
        } catch (probeErr: any) {
          testError = {
            code: probeErr.code,
            message: probeErr.message
          };
          if (probeErr.message?.includes('cloudmessaging.messages.create') || probeErr.code === 'messaging/mismatched-credential') {
            fcmHttpApiStatus = 'iam_permission_missing';
            iamDiagnosticMessage = `Service account "${saInfo?.client_email}" requires the IAM permission "cloudmessaging.messages.create" (Role: "roles/firebasecloudmessaging.admin") on project "${saInfo?.project_id || 'laxmi-artworks'}".`;
          } else if (
            probeErr.code === 'messaging/invalid-registration-token' ||
            probeErr.code === 'messaging/registration-token-not-registered' ||
            probeErr.code === 'messaging/argument-error' ||
            probeErr.code === 'messaging/invalid-argument'
          ) {
            // If the probe reached token validation, FCM API & IAM are authorized!
            fcmHttpApiStatus = 'fcm_api_authorized_and_ready';
          }
        }
      }

      res.json({
        success: true,
        initialized: isInitialized,
        targetProjectId: saInfo?.project_id || "laxmi-artworks",
        serviceAccountEmail: saInfo?.client_email || "Application Default Credentials",
        requiredIAMPermission: "cloudmessaging.messages.create",
        requiredIAMRole: "roles/firebasecloudmessaging.admin",
        fcmHttpApiStatus,
        iamDiagnosticMessage: iamDiagnosticMessage || undefined,
        testError: testError || undefined
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Subscribe Token(s) to FCM Topic
  app.post("/api/subscribe-topic", async (req, res) => {
    const { token, tokens, topic = 'all_users' } = req.body;
    const tokenList = tokens || (token ? [token] : []);
    if (!getApps().length) {
      return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }
    if (!tokenList.length) {
      return res.status(400).json({ error: 'No tokens provided' });
    }
    try {
      const response = await getMessaging().subscribeToTopic(tokenList, topic);
      console.log(`[Topic API] Subscribed ${tokenList.length} token(s) to topic "${topic}"`);
      res.json({ success: true, response });
    } catch (err: any) {
      console.error('[Topic API] Topic subscription error:', err.message);
      res.status(500).json({ error: err.message });
    }
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

  // Broadcast Push Notification (Supports topic OR token multicast)
  app.post("/api/broadcast-push", async (req, res) => {
    const { tokens, topic, title, body, url } = req.body;
    console.log(`[Push API] Broadcast requested. Topic: ${topic || 'none'}, Tokens count: ${tokens?.length || 0}`);
    
    if (!getApps().length) {
      console.error('[Push API] Firebase Admin not configured.');
      return res.status(500).json({ error: 'Firebase Admin not configured' });
    }

    try {
      if (topic) {
        const response = await getMessaging().send({
          topic,
          notification: { title, body },
          data: { url: url || '/' }
        });
        console.log(`[Push API] Topic broadcast sent successfully: ${response}`);
        return res.json({ success: true, messageId: response });
      }
      
      if (!tokens || !tokens.length) {
        console.error('[Push API] Missing tokens or topic.');
        return res.status(400).json({ error: 'Missing tokens or topic' });
      }

      const message = {
        tokens,
        notification: { title, body },
        data: { url: url || '/' }
      };
      const response = await getMessaging().sendEachForMulticast(message);
      
      console.log(`[Push API] Broadcast success count: ${response.successCount}, failure count: ${response.failureCount}`);
      
      if (response.failureCount > 0) {
        response.responses.forEach(async (resp, idx) => {
          if (!resp.success) {
            console.error(`[Push API] Failed to send to token ${tokens[idx]}: ${resp.error?.message}`);
            if (resp.error?.code === 'messaging/invalid-registration-token' ||
                resp.error?.code === 'messaging/registration-token-not-registered') {
              const invalidToken = tokens[idx];
              console.log(`[Push API] Cleaning up invalid token: ${invalidToken}`);
              try {
                const fcmSnap = await getDocs(collection(db, 'fcm_tokens'));
                fcmSnap.forEach(async (docSnap) => {
                  const data = docSnap.data();
                  if (data.tokens && data.tokens.includes(invalidToken)) {
                    const filtered = data.tokens.filter((t: string) => t !== invalidToken);
                    await updateDoc(doc(db, 'fcm_tokens', docSnap.id), { tokens: filtered });
                  }
                });
              } catch (e) { /* ignore */ }
            }
          }
        });
      }
      
      res.json({ success: true, response });
    } catch (err: any) {
      console.error('[Push API] FCM Broadcast Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });
  
  app.post("/api/send-invoice", async (req, res) => {
    const { email, order, pdfBase64 } = req.body;
    
    if (!email) {
       return res.status(400).json({ success: false, error: 'Customer email is missing.' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
       return res.status(400).json({ success: false, error: 'Invalid customer email format.' });
    }
    

    
    try {
      console.log(`[INVOICE] Request received for ${email}`);
      console.log(`[EMAIL CONFIG]`);
      console.log(`runtime: server`);
      console.log(`GMAIL_USER: ${process.env.GMAIL_USER ? 'PRESENT' : 'MISSING'}`);
      console.log(`GMAIL_APP_PASSWORD: ${process.env.GMAIL_APP_PASSWORD ? 'PRESENT' : 'MISSING'}`);
      
      const user = process.env.GMAIL_USER || process.env.IMAP_USER;
      const pass = process.env.GMAIL_APP_PASSWORD || process.env.IMAP_PASS;
      
      if (!user || !pass) {
          throw new Error('Email server credentials not configured (GMAIL_USER or GMAIL_APP_PASSWORD missing).');
      }
      
      console.log(`[INVOICE] Customer email validated`);
      console.log(`[INVOICE] Preparing email`);
      
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
      
      console.log(`[INVOICE] Connecting to email service...`);
      
      // Verify transporter before sending
      await transporter.verify().catch(err => {
        console.error(`[INVOICE] FAILED verification: `, err.message);
        throw new Error('Email service authentication or connection failed. Check credentials.');
      });
      
      const invoiceNumber = order.orderId || order.id?.substring(0, 8).toUpperCase();
      const amount = order.amount || '0';
      const status = order.paymentStatus || 'Pending';
      
      const mailOptions = {
        from: user,
        to: email,
        subject: `Laxmi Artworks — Invoice ${invoiceNumber} for Order ${order.orderId || order.id}`,
        text: `Hello ${order.name || 'Customer'},

Thank you for choosing Laxmi Artworks.

Please find your invoice attached for Order ${order.orderId || order.id}.

Invoice: ${invoiceNumber}
Amount: ₹${amount}
Payment Status: ${status}

For any questions, please contact:
support@laxmiartworks.com

Regards,
Laxmi Artworks
NECRONIC IND. PVT. LTD.
Tinsukia, Assam`,
        attachments: [
          {
            filename: `Invoice_${order.orderId || order.id}.pdf`,
            content: pdfBase64.split("base64,")[1],
            encoding: 'base64'
          }
        ]
      };
      
      console.log(`[INVOICE] Sending email to ${email}...`);
      const info = await transporter.sendMail(mailOptions);
      console.log(`[INVOICE] Email provider responded: ${info.messageId}`);
      console.log(`[INVOICE] Completed`);
      
      res.json({ success: true });
    } catch (err: any) {
      console.error('[INVOICE] FAILED:', err.message);
      res.status(500).json({ success: false, error: err.message || 'SMTP Connection failed or rejected.' });
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
         text: `Your order ${orderId} shipment status has been updated to: ${status}.

Courier: ${courierPartner}
Tracking ID: ${trackingId}
Estimated Delivery: ${estimatedDelivery || 'N/A'}

You can track your order using the provided tracking ID.`
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

  // Start background tasks
  verifyPaymentsBackground();
  setInterval(verifyPaymentsBackground, 30000); // Check every 30s
  startOrderWatcher();

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
