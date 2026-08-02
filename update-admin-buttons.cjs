const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const regex = /<button \s*onClick=\{\(\) => \{(?:\s*setEditingId\(selectedOrder\.id\);\s*setEditForm\(selectedOrder\);\s*)\}\}\s*className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-white text-black hover:bg-neutral-200 transition-colors"\s*>\s*<Edit2 size=\{16\} \/> Edit Details\s*<\/button>/g;

const newButtons = `                       {selectedOrder.paymentStatus === 'Pending Verification' && (
                         <button
                           onClick={async () => {
                             if (window.confirm("Mark this order as verified manually?")) {
                               try {
                                 await updateDoc(doc(db, 'orders', selectedOrder.id), {
                                   paymentStatus: 'Paid',
                                   status: 'Drafting & Concept',
                                   paymentVerificationNote: \`Manually Verified (Admin: \${user?.email})\`,
                                   lastVerifiedAt: Date.now(),
                                   lastVerifiedBy: user?.email || 'admin'
                                 });
                                 setSelectedOrder({...selectedOrder, paymentStatus: 'Paid', status: 'Drafting & Concept', paymentVerificationNote: \`Manually Verified (Admin: \${user?.email})\`});
                               } catch (err) {
                                 console.error("Error verifying payment", err);
                               }
                             }
                           }}
                           className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-green-500 text-black hover:bg-green-400 transition-colors"
                         >
                           <CheckCircle2 size={16} /> Verify Payment
                         </button>
                       )}
                       <button 
                         onClick={() => {
                           setEditingId(selectedOrder.id);
                           setEditForm(selectedOrder);
                         }}
                         className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-white text-black hover:bg-neutral-200 transition-colors"
                       >
                         <Edit2 size={16} /> Edit Details
                       </button>`;

code = code.replace(regex, newButtons);
fs.writeFileSync('src/components/AdminPanel.tsx', code);
