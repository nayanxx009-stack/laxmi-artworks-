const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const orig = `await updateDoc(doc(db, 'orders', id), updateData);
      setEditingId(null);
      
      if (isNewShipment && editForm.email) {`;

const repl = `await updateDoc(doc(db, 'orders', id), updateData);
      setEditingId(null);
      setSelectedOrder({ ...selectedOrder, ...updateData });
      
      if (isNewShipment && editForm.email) {`;

code = code.replace(orig, repl);
fs.writeFileSync('src/components/AdminPanel.tsx', code);
