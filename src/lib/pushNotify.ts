import { getDocs, collection, query, where, getDoc, doc } from 'firebase/firestore';
import { db } from './firebase';

export const sendPushToUser = async (userId: string, title: string, body: string, url: string = '/') => {
  try {
    const tokenDoc = await getDoc(doc(db, 'fcm_tokens', userId));
    if (tokenDoc.exists()) {
      const data = tokenDoc.data();
      const tokens = data.tokens || (data.token ? [data.token] : []);
      
      if (tokens.length > 0) {
        await fetch('/api/broadcast-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokens, title, body, url })
        });
      }
    }
  } catch (err) {
    console.error('Failed to send push to user', err);
  }
};

export const sendPushToAdmins = async (title: string, body: string, url: string = '/') => {
  try {
    const adminQuery = query(collection(db, 'admins'));
    const adminDocs = await getDocs(adminQuery);
    const adminEmails = adminDocs.docs.map(d => d.id);
    adminEmails.push('nayanxx009@gmail.com', 'gargsubhalaxmi@gmail.com', 'admin@example.com', 'server@laxmiartworks.local');

    const fcmDocs = await getDocs(collection(db, 'fcm_tokens'));
    const tokens: string[] = [];
    fcmDocs.forEach(d => {
      if (adminEmails.includes(d.data().email)) {
        tokens.push(d.data().token);
      }
    });

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
