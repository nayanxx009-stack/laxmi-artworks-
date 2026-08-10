const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const origBtn = `<button onClick={async () => {
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
                          
                          const controller = new AbortController();
                          const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
                          
                          const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/send-invoice', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: selectedOrder.email, order: selectedOrder, pdfBase64 }),
                            signal: controller.signal
                          });
                          clearTimeout(timeoutId);
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

const replBtn = `<button onClick={async (e) => {
                        const btn = e.currentTarget;
                        btn.disabled = true;
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
                          
                          const controller = new AbortController();
                          const timeoutId = setTimeout(() => controller.abort(), 20000);
                          
                          const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/send-invoice', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: selectedOrder.email, order: selectedOrder, pdfBase64 }),
                            signal: controller.signal
                          });
                          clearTimeout(timeoutId);
                          
                          const data = await res.json().catch(() => ({}));
                          if (!res.ok || !data.success) {
                            throw new Error(data.error || 'Failed to send invoice. Please check email configuration.');
                          }
                          
                          setSaveSuccessMessage("✅ Invoice sent successfully");
                          setTimeout(() => setSaveSuccessMessage(''), 5000);
                        } catch (err: any) {
                          const isAbort = err.name === 'AbortError' || err.message.includes('abort');
                          setSaveSuccessMessage("❌ " + (isAbort ? "Connection timed out" : err.message));
                          setTimeout(() => setSaveSuccessMessage(''), 7000);
                        } finally {
                          btn.disabled = false;
                        }
                      }} className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-neutral-800 text-amber-500 border border-amber-500/30 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        <Mail size={16} /> Send Invoice
                      </button>`;

if (code.includes(origBtn)) {
  code = code.replace(origBtn, replBtn);
  fs.writeFileSync('src/components/AdminPanel.tsx', code);
  console.log('Fixed btn');
} else {
  console.log('Not found');
}
