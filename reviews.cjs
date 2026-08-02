const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const reviewsBlockStart = `{dashboardView === 'reviews' && (`;
const reviewsBlockEnd = `                  )}`;

const searchStart = code.indexOf(reviewsBlockStart);
const searchEnd = code.indexOf(reviewsBlockEnd, searchStart) + reviewsBlockEnd.length;

const searchString = code.substring(searchStart, searchEnd);

const newReviews = `{dashboardView === 'reviews' && (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-black/20 text-xs uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/5">
                          <th className="p-5 pl-6 whitespace-nowrap">User</th>
                          <th className="p-5 whitespace-nowrap">Review</th>
                          <th className="p-5 whitespace-nowrap">Status</th>
                          <th className="p-5 whitespace-nowrap text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {reviews.length === 0 ? (
                           <tr><td colSpan={4} className="p-8 text-center text-neutral-500">No reviews found.</td></tr>
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
                              <td className="p-5 align-top">
                                <select 
                                  value={r.status || 'pending'} 
                                  onChange={(e) => updateReviewStatus(r.id, e.target.value)}
                                  className="bg-black/50 border border-white/10 text-white text-xs rounded-xl py-2 px-3 outline-none focus:border-amber-500 appearance-none min-w-[100px]"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="approved">Approved</option>
                                </select>
                              </td>
                              <td className="p-5 align-top text-right">
                                <button 
                                  onClick={() => deleteReview(r.id)}
                                  className="p-2 text-red-400 hover:text-red-300 bg-red-400/5 hover:bg-red-400/10 rounded-xl transition-all"
                                  title="Delete Review"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}`;

code = code.replace(searchString, newReviews);
fs.writeFileSync('src/components/AdminPanel.tsx', code);
