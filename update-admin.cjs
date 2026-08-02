const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');
code = code.replace(/<option value="Verified">Payment: Verified<\/option>/, `<option value="Paid">Payment: Paid</option>\n<option value="Verified">Payment: Verified</option>`);
code = code.replace(/<option value="Verified">Verified<\/option>/g, `<option value="Paid">Paid</option>\n<option value="Verified">Verified</option>`);
code = code.replace(/order\.paymentStatus === 'Verified'/g, `(order.paymentStatus === 'Verified' || order.paymentStatus === 'Paid')`);
fs.writeFileSync('src/components/AdminPanel.tsx', code);
