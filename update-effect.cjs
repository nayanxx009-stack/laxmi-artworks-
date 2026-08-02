const fs = require('fs');
let code = fs.readFileSync('src/components/Contact.tsx', 'utf8');

const regex = /  useEffect\(\(\) => \{\s*try \{\s*\} catch \(e\) \{\s*console\.error\("Failed to restore payment state", e\);\s*\}\s*\}, \[\]\);/;

const newEffect = `  useEffect(() => {
    if (!firebaseDocId || !showPaymentModal) return;
    const unsub = onSnapshot(doc(db, 'orders', firebaseDocId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.paymentStatus === 'Paid') {
          setShowPaymentModal(false);
          setShowSuccessPopup(true);
          setPendingForm(null);
          setFormData({
            name: '',
            email: '',
            phone: '',
            subject: '',
            message: ''
          });
        }
      }
    });
    return () => unsub();
  }, [firebaseDocId, showPaymentModal]);`;

code = code.replace(regex, newEffect);
fs.writeFileSync('src/components/Contact.tsx', code);
