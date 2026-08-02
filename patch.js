const fs = require('fs');
const content = fs.readFileSync('src/components/Contact.tsx', 'utf8');
const lines = content.split('\n');
const start = 173; // 0-indexed for line 174
const end = 227; // 0-indexed for line 228

const newLines = `  const finalizePaymentAndOrder = async (e?: any) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    
    if (!firebaseDocId) return;

    setPaymentVerifyState('verifying');
    
    try {
      const docRef = doc(db, 'orders', firebaseDocId);
      await updateDoc(docRef, {
        paymentStatus: 'Payment Submitted',
        status: 'Payment Submitted'
      });
    } catch (err) {
      console.error("Failed to update order in Firebase:", err);
    }
  };`;

lines.splice(start, end - start + 1, newLines);
fs.writeFileSync('src/components/Contact.tsx', lines.join('\n'));
