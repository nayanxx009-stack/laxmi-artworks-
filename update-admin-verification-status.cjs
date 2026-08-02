const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

code = code.replace(
  `{order.paymentStatus === 'Payment Submitted' && (`,
  `{(order.paymentStatus === 'Payment Submitted' || order.paymentStatus === 'Pending Verification') && (`
);

code = code.replace(
  `className={\`bg-black/50 border border-white/10 text-xs rounded-xl py-2 px-3 outline-none focus:border-amber-500 appearance-none min-w-[140px] block \${order.paymentStatus === 'Payment Submitted' ? 'text-amber-400 border-amber-500/50' : (order.paymentStatus === 'Verified' || order.paymentStatus === 'Paid') ? 'text-green-400 border-green-500/50' : 'text-neutral-400'}\`}`,
  `className={\`bg-black/50 border border-white/10 text-xs rounded-xl py-2 px-3 outline-none focus:border-amber-500 appearance-none min-w-[140px] block \${(order.paymentStatus === 'Payment Submitted' || order.paymentStatus === 'Pending Verification') ? 'text-amber-400 border-amber-500/50' : (order.paymentStatus === 'Verified' || order.paymentStatus === 'Paid') ? 'text-green-400 border-green-500/50' : 'text-neutral-400'}\`}`
);

code = code.replace(
  `<option value="Payment Submitted">Payment: Submitted</option>`,
  `<option value="Payment Submitted">Payment: Submitted</option>
                                <option value="Pending Verification">Pending Verification</option>`
);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
