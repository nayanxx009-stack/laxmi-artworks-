import { getDocs, collection, query, where, getDoc, doc } from 'firebase/firestore';
import { db } from './firebase';

export const sendPushToUser = async (userId: string, title: string, body: string, url: string = '/', overrideDb?: any) => {
  const firestoreDb = overrideDb || db;
  try {
    const tokenSet = new Set<string>();

    // 1. Check multi-device subcollection
    try {
      const subColSnap = await getDocs(collection(firestoreDb, 'users', userId, 'notificationTokens'));
      subColSnap.forEach(d => {
        const data = d.data();
        if (data.token && data.enabled !== false) {
          tokenSet.add(data.token);
        }
      });
    } catch (e) {
      // ignore
    }

    // 2. Check legacy fcm_tokens doc
    try {
      const tokenDoc = await getDoc(doc(firestoreDb, 'fcm_tokens', userId));
      if (tokenDoc.exists()) {
        const data = tokenDoc.data();
        const tokensList = data.tokens || (data.token ? [data.token] : []);
        tokensList.forEach((t: string) => tokenSet.add(t));
      }
    } catch (e) {
      // ignore
    }

    const tokens = Array.from(tokenSet);
    if (tokens.length > 0) {
      await fetch('/api/broadcast-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens, title, body, url })
      });
    }
  } catch (err) {
    console.error('Failed to send push to user', err);
  }
};

export const sendPushToAdmins = async (title: string, body: string, url: string = '/', overrideDb?: any) => {
  const firestoreDb = overrideDb || db;
  try {
    const adminQuery = query(collection(firestoreDb, 'admins'));
    const adminDocs = await getDocs(adminQuery);
    const adminEmails = adminDocs.docs.map(d => d.id.toLowerCase());
    adminEmails.push('nayanxx009@gmail.com', 'gargsubhalaxmi@gmail.com', 'admin@example.com', 'server@laxmiartworks.local');

    const tokenSet = new Set<string>();

    const fcmDocs = await getDocs(collection(firestoreDb, 'fcm_tokens'));
    fcmDocs.forEach(d => {
      const data = d.data();
      if (adminEmails.includes((data.email || '').toLowerCase())) {
        if (data.tokens && Array.isArray(data.tokens)) {
          data.tokens.forEach((t: string) => tokenSet.add(t));
        } else if (data.token) {
          tokenSet.add(data.token);
        }
      }
    });

    const tokens = Array.from(tokenSet);
    if (tokens.length > 0) {
      await fetch('/api/broadcast-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens, title, body, url })
      });
    }
  } catch (err) {
    console.error('Failed to send push to admins', err);
  }
};
