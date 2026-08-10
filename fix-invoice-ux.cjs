const fs = require('fs');

let libCode = fs.readFileSync('src/lib/generateInvoice.ts', 'utf8');
libCode = libCode.replace(/export const generateInvoice = async \(order: any, type: 'download' \| 'email' = 'download'\) => \{/, "export const generateInvoice = async (order: any, type: 'download' | 'email' | 'base64' = 'download') => {");
libCode = libCode.replace(/\} else if \(type === 'email'\) \{[\s\S]*\}\n\};\n/m, `} else if (type === 'email') {
    const pdfBase64 = doc.output('datauristring');
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: order.email, order, pdfBase64 })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send invoice');
      }
    } catch (e: any) {
      throw new Error(e.message || 'Error sending invoice');
    }
  } else if (type === 'base64') {
    return doc.output('datauristring');
  }
};`);
fs.writeFileSync('src/lib/generateInvoice.ts', libCode);

let appCode = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const origButton = `<button onClick={async () => {
                        try {
                          setSaveSuccessMessage("Sending invoice...");
                          await generateInvoice(selectedOrder, 'email');
                          setSaveSuccessMessage("✅ Invoice sent successfully to " + selectedOrder.email);
                          setTimeout(() => setSaveSuccessMessage(''), 5000);
                        } catch (err: any) {
                          setSaveSuccessMessage("❌ " + err.message);
                          setTimeout(() => setSaveSuccessMessage(''), 5000);
                        }
                      }} className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-neutral-800 text-amber-500 border border-amber-500/30 hover:bg-neutral-700">
                        <Mail size={16} /> Send Invoice
                      </button>`;

const replButton = `<button onClick={async () => {
                        try {
                          if (!selectedOrder.email) {
                             throw new Error("Customer email missing");
                          }
                          setSaveSuccessMessage("Preparing invoice...");
                          await new Promise(r => setTimeout(r, 600));
                          
                          setSaveSuccessMessage("Generating PDF...");
                          const pdfBase64 = await generateInvoice(selectedOrder, 'base64');
                          await new Promise(r => setTimeout(r, 600));
                          
                          setSaveSuccessMessage(\`Sending invoice to \${selectedOrder.email}...\`);
                          
                          const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/send-invoice', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: selectedOrder.email, order: selectedOrder, pdfBase64 })
                          });
                          const data = await res.json();
                          if (!res.ok || !data.success) {
                            throw new Error(data.error || 'Failed to send invoice');
                          }
                          
                          setSaveSuccessMessage("✅ Invoice sent successfully");
                          setTimeout(() => setSaveSuccessMessage(''), 5000);
                        } catch (err: any) {
                          setSaveSuccessMessage("❌ " + err.message);
                          setTimeout(() => setSaveSuccessMessage(''), 7000);
                        }
                      }} className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-neutral-800 text-amber-500 border border-amber-500/30 hover:bg-neutral-700 disabled:opacity-50">
                        <Mail size={16} /> Send Invoice
                      </button>`;

if (appCode.includes(origButton)) {
   appCode = appCode.replace(origButton, replButton);
   fs.writeFileSync('src/components/AdminPanel.tsx', appCode);
   console.log("Updated AdminPanel UX");
} else {
   console.log("Could not find button in AdminPanel.tsx");
}
