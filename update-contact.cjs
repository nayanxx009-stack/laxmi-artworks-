const fs = require('fs');
let code = fs.readFileSync('src/components/Contact.tsx', 'utf8');

code = code.replace(`    // Save to Firebase (Primary Lead Capture)
    
    const newDocRef = doc(collection(db, 'orders'));
    setFirebaseDocId(newDocRef.id);
    firebaseDocIdRef.current = newDocRef.id;
    setDoc(newDocRef, orderData).catch(err => console.error("Firebase lead capture failed:", err));`, `    // Will save to Firebase after payment is submitted`);

code = code.replace(`      const currentDocId = firebaseDocId || firebaseDocIdRef.current;
      if (currentDocId) {
        try {
          await updateDoc(doc(db, 'orders', currentDocId), { 
            paymentStatus: updatedPaymentStatus,
            status: updatedStatus
          });
        } catch (err) {
          console.error("Failed to update Firebase order status:", err);
        }
      }`, `      try {
        const orderData = {
          orderId: id,
          userId: user ? user.uid : "guest_" + Date.now(),
          name: form.name,
          email: form.email,
          phone: form.phone,
          message: form.message,
          amount: 100,
          paymentStatus: updatedPaymentStatus,
          status: updatedStatus,
          createdAt: Date.now()
        };
        const newDocRef = doc(collection(db, 'orders'));
        await setDoc(newDocRef, orderData);
        setFirebaseDocId(newDocRef.id);
        firebaseDocIdRef.current = newDocRef.id;
      } catch (err) {
        console.error("Failed to save order to Firebase:", err);
      }`);

fs.writeFileSync('src/components/Contact.tsx', code);
