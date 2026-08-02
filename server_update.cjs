const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const adminImport = `import nodemailer from 'nodemailer';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';`;

const newAdminImport = `import nodemailer from 'nodemailer';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import admin from 'firebase-admin';

// Initialize Firebase Admin if Service Account is provided
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('[Server] Firebase Admin initialized for FCM.');
  } catch (e) {
    console.error('[Server] Failed to initialize Firebase Admin:', e.message);
  }
}
`;

code = code.replace(adminImport, newAdminImport);

const notifyEndpoint = `  app.post("/api/notify-shipment", async (req, res) => {`;
const newNotifyEndpoint = `  // Send Push Notification via FCM
  app.post("/api/send-push", async (req, res) => {
    const { token, title, body, url } = req.body;
    if (!admin.apps.length) {
      return res.status(500).json({ error: 'Firebase Admin not configured' });
    }
    try {
      const message = {
        token,
        notification: { title, body },
        data: { url: url || '/' }
      };
      await admin.messaging().send(message);
      res.json({ success: true });
    } catch (err) {
      console.error('FCM Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Broadcast Push Notification
  app.post("/api/broadcast-push", async (req, res) => {
    const { tokens, title, body, url } = req.body;
    if (!admin.apps.length) {
      return res.status(500).json({ error: 'Firebase Admin not configured' });
    }
    try {
      const message = {
        tokens,
        notification: { title, body },
        data: { url: url || '/' }
      };
      const response = await admin.messaging().sendEachForMulticast(message);
      res.json({ success: true, response });
    } catch (err) {
      console.error('FCM Broadcast Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/notify-shipment", async (req, res) => {`;

code = code.replace(notifyEndpoint, newNotifyEndpoint);

fs.writeFileSync('server.ts', code);
