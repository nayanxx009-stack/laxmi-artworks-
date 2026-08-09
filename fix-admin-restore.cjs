const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const missingCode = `
            {showPopupPreview && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="relative max-w-md md:max-w-xl w-full flex flex-col items-center justify-center rounded-3xl overflow-hidden shadow-2xl">
                  <button onClick={() => setShowPopupPreview(false)} className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-md">
                    <X size={20} />
                  </button>
                  {localSiteConfig.popupImage ? (
                    <img src={localSiteConfig.popupImage} alt="Announcement" className="w-full object-contain max-h-[85vh] bg-black" />
                  ) : (
                    <div className="w-full h-64 bg-neutral-900 flex items-center justify-center text-neutral-500">No image uploaded</div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ADMINS TAB */}
        {activeTab === 'admins' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-4xl mx-auto space-y-6">
            <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Users className="text-amber-500" /> Authorized Personnel</h2>
              {loadingAdmins ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-amber-500 w-8 h-8" /></div>
              ) : (
                <div className="space-y-4">
                  {adminsList.map((a: any) => (
                    <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black rounded-xl border border-white/5 gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30 text-amber-500">
                           <Shield size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-white">{a.email}</p>
                          <p className="text-xs text-neutral-400 capitalize">{a.role} Access</p>
                        </div>
                      </div>
                      
                      {isOwner && a.email !== user?.email && (
                        <div className="flex gap-2">
                          <select 
                            value={a.role}
                            onChange={(e) => updateAdminRole(a.id, e.target.value)}
                            className="bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                          >
                            <option value="admin">Admin</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* GLOBAL ORDER DETAIL MODAL */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-white/10 rounded-2xl max-w-2xl w-full my-8 shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center sticky top-0 bg-neutral-900/90 backdrop-blur-md rounded-t-2xl z-10">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  Order Details
                </h3>
                <button onClick={() => { setSelectedOrder(null); setEditingId(null); }} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-bold text-neutral-400 mb-2 uppercase tracking-wider">Customer</h4>
                    <div className="space-y-1">
                      <p className="font-medium text-lg">{selectedOrder.name}</p>
                      <p className="text-neutral-300">{selectedOrder.email}</p>
                      <p className="text-neutral-300">{selectedOrder.phone}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-neutral-400 mb-2 uppercase tracking-wider">Order Info</h4>
                    <div className="space-y-1">
                      <p className="font-mono text-amber-500 text-sm">ID: {selectedOrder.orderId || selectedOrder.id}</p>
                      <p className="text-neutral-300">Date: {new Date(selectedOrder.createdAt).toLocaleString()}</p>
                      <p className="text-neutral-300 font-medium">Amount: ₹{selectedOrder.amount}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-neutral-400 mb-2 uppercase tracking-wider">Artwork Details</h4>
                  <div className="bg-black p-4 rounded-xl border border-white/5 grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-neutral-500 block mb-1">Subject:</span> {selectedOrder.subject}</div>
                    <div><span className="text-neutral-500 block mb-1">Size:</span> {selectedOrder.size}</div>
                    <div><span className="text-neutral-500 block mb-1">Medium:</span> {selectedOrder.medium}</div>
                    <div><span className="text-neutral-500 block mb-1">Framing:</span> {selectedOrder.framing}</div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-neutral-400 mb-2 uppercase tracking-wider">Shipping Address</h4>
                  <div className="bg-black p-4 rounded-xl border border-white/5 text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
                    {selectedOrder.address}
                  </div>
                </div>

                {editingId === selectedOrder.id ? (
                  <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl space-y-4">
                    <h4 className="font-bold text-amber-500 flex items-center gap-2">
                      <Edit2 size={16} /> Edit Order Status
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-neutral-400 mb-1 block">Order Status</label>
                        <select 
                          value={editForm.status || 'Payment Submitted'} 
                          onChange={(e) => setEditForm({...editForm, status: e.target.value})}
`;

code = code.replace(
  /className="w-full bg-black border border-white\/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 outline-none"\n\s*>\n\s*<option value="Payment Submitted">/,
  missingCode + `\n                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 outline-none"\n                        >\n                          <option value="Payment Submitted">`
);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
