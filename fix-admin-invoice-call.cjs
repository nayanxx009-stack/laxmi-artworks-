const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

code = code.replace(
  /<button onClick=\{\(\) => generateInvoice\(selectedOrder, 'email'\)\} className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-neutral-800 text-amber-500 border border-amber-500\/30 hover:bg-neutral-700">/g,
  `<button onClick={async () => {
                        try {
                          setSaveSuccessMessage("Sending invoice...");
                          await generateInvoice(selectedOrder, 'email');
                          setSaveSuccessMessage("✅ Invoice sent successfully to " + selectedOrder.email);
                          setTimeout(() => setSaveSuccessMessage(''), 5000);
                        } catch (err: any) {
                          setSaveSuccessMessage("❌ " + err.message);
                          setTimeout(() => setSaveSuccessMessage(''), 5000);
                        }
                      }} className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-neutral-800 text-amber-500 border border-amber-500/30 hover:bg-neutral-700">`
);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
