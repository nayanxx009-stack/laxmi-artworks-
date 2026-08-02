
import { updateDoc, doc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

export async function verifyPayments(accessToken: string | null, onProgress: (msg: string) => void) {
  // Now we use the backend API which handles its own authentication via env vars
  onProgress("Fetching pending orders...");
  const q = query(collection(db, 'orders'), where('status', '==', 'Pending Payment'));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    onProgress("No pending payments found.");
    return;
  }

  const pendingOrders = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
  onProgress(`Found ${pendingOrders.length} pending order(s). Checking Gmail...`);

  let verifiedCount = 0;
  for (const order of pendingOrders) {
    if (!order.orderId) continue;
    
    try {
      const res = await fetch(`/api/gmail/search?q=${encodeURIComponent(order.orderId)}`);
      const data = await res.json();
      
      if (data.messages && data.messages.length > 0) {
        let isPaid = false;
        
        for (const msg of data.messages) {
          const snippet = msg.snippet || "";
          const bodyData = msg.body || "";
          const amountStr = String(order.amount);
          
          if (snippet.includes(amountStr) || snippet.includes(amountStr + ".00") || bodyData.includes(amountStr) || bodyData.includes(amountStr + ".00")) {
             // Try to extract UTR (12 digit UPI reference)
             const utrMatch = bodyData.match(/\b\d{12}\b/);
             const utr = utrMatch ? utrMatch[0] : null;
             
             onProgress(`Verified payment for ${order.orderId}. Updating status...`);
             await updateDoc(doc(db, 'orders', order.id), {
               status: 'Drafting & Concept',
               paymentStatus: 'Verified (via Gmail)',
               ...(utr && { transactionReference: utr })
             });
             verifiedCount++;
             isPaid = true;
             break;
          }
        }
      }
    } catch (e) {
      console.error(`Error verifying order ${order.orderId}`, e);
    }
  }

  onProgress(`Verification complete. ${verifiedCount} order(s) updated.`);
}
