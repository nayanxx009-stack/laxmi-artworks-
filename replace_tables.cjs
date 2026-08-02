const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const tableBlockStart = `<div className="bg-neutral-900 border border-white/5 rounded-3xl overflow-hidden shadow-xl mt-8">`;
const tableBlockEnd = `                  </table>
                </div>
              </div>`;

const searchString = code.substring(code.indexOf(tableBlockStart), code.indexOf(tableBlockEnd) + tableBlockEnd.length);

const newTables = `              <div className="bg-neutral-900 border border-white/5 rounded-3xl overflow-hidden shadow-xl mt-8">
                <div className="overflow-x-auto">
                  {dashboardView === 'orders' && (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-black/20 text-xs uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/5">
                        <th className="p-5 pl-6 whitespace-nowrap">Order Info</th>
                        <th className="p-5 whitespace-nowrap">Customer</th>
                        <th className="p-5 whitespace-nowrap">Status</th>
                        <th className="p-5 whitespace-nowrap text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {loading && orders.length === 0 ? (
                        <tr><td colSpan={4} className="p-8 text-center text-neutral-500">Loading orders...</td></tr>
                      ) : orders.length === 0 ? (
                        <tr><td colSpan={4} className="p-8 text-center text-neutral-500">No orders found.</td></tr>
                      ) : (
                        orders.map((order) => (
                          <tr key={order.id} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="p-5 pl-6 align-top">
                              <div className="text-xs font-mono text-amber-500 mb-1">{order.orderId || order.id.slice(0,8)}</div>
                              <div className="text-sm text-white">{new Date(order.createdAt).toLocaleDateString()}</div>
                              {order.paymentStatus === 'Verified (FamApp / Triö UPI)' && (
                                <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                                  <CheckCircle2 size={10} /> Paid Advance
                                </div>
                              )}
                            </td>
                            <td className="p-5 align-top">
                              <div className="font-semibold text-sm text-white">{order.name}</div>
                              <div className="text-xs text-neutral-400">{order.email}</div>
                              <div className="text-xs text-neutral-400">{order.phone}</div>
                            </td>
                            <td className="p-5 align-top">
                              <select 
                                value={order.status} 
                                onChange={(e) => handleUpdateOrder(order.id, 'status', e.target.value)}
                                className="bg-black/50 border border-white/10 text-white text-xs rounded-xl py-2 px-3 outline-none focus:border-amber-500 appearance-none min-w-[140px]"
                              >
                                <option value="Live (Studio Drafting & Canvas Work)">Drafting</option>
                                <option value="Sketching Started">Sketching</option>
                                <option value="Painting/Shading">Painting/Shading</option>
                                <option value="Ready For Delivery">Ready For Delivery</option>
                                <option value="Completed">Completed</option>
                                <option value="Cancelled">Cancelled</option>
                              </select>
                            </td>
                            <td className="p-5 align-top text-right">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => setSelectedOrder(order)}
                                  className="p-2 text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                                  title="View Details"
                                >
                                  <Eye size={16} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteOrder(order.id)}
                                  className="p-2 text-red-400 hover:text-red-300 bg-red-400/5 hover:bg-red-400/10 rounded-xl transition-all"
                                  title="Delete Order"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  )}

                  {dashboardView === 'users' && (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-black/20 text-xs uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/5">
                          <th className="p-5 pl-6 whitespace-nowrap">Email</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {usersList.length === 0 ? (
                           <tr><td className="p-8 text-center text-neutral-500">No engaged users found.</td></tr>
                        ) : (
                          usersList.map((u, i) => (
                            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-5 pl-6 text-sm text-white">{u.email}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  {dashboardView === 'subscribers' && (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-black/20 text-xs uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/5">
                          <th className="p-5 pl-6 whitespace-nowrap">Email</th>
                          <th className="p-5 whitespace-nowrap text-right">Subscribed At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {subscribers.length === 0 ? (
                           <tr><td colSpan={2} className="p-8 text-center text-neutral-500">No subscribers found.</td></tr>
                        ) : (
                          subscribers.map((s, i) => (
                            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-5 pl-6 text-sm text-white">{s.email}</td>
                              <td className="p-5 text-sm text-neutral-400 text-right">{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'N/A'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  {dashboardView === 'reviews' && (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-black/20 text-xs uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/5">
                          <th className="p-5 pl-6 whitespace-nowrap">User</th>
                          <th className="p-5 whitespace-nowrap">Review</th>
                          <th className="p-5 whitespace-nowrap text-right">Rating</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {reviews.length === 0 ? (
                           <tr><td colSpan={3} className="p-8 text-center text-neutral-500">No reviews found.</td></tr>
                        ) : (
                          reviews.map((r, i) => (
                            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-5 pl-6 align-top">
                                <div className="text-sm text-white">{r.userName || 'Anonymous'}</div>
                                <div className="text-xs text-neutral-400">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</div>
                              </td>
                              <td className="p-5 align-top">
                                <div className="text-sm text-neutral-300 line-clamp-2">{r.comment}</div>
                              </td>
                              <td className="p-5 align-top text-right text-amber-500 text-sm font-bold">
                                {r.rating} / 5
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>`;

code = code.replace(searchString, newTables);
fs.writeFileSync('src/components/AdminPanel.tsx', code);
