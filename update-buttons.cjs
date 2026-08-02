const fs = require('fs');
let code = fs.readFileSync('src/components/Contact.tsx', 'utf8');

const regex2 = /<\!-- Action Buttons -->[\s\S]*?Confirm Payment Submitted[\s\S]*?<\/button>[\s\S]*?<\/button>[\s\S]*?<\/div>/;

const newButtons = `{/* Action Buttons */}
                  <div className="pt-2 flex flex-col gap-3">
                    <div className="w-full py-4 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 text-center font-bold uppercase tracking-widest text-[11px] flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
                      Waiting for Payment...
                    </div>
                    <button
                      onClick={() => {
                        setShowPaymentModal(false);
                        setStatus('idle');
                      }}
                      className="w-full py-3.5 rounded-2xl border border-white/10 text-neutral-400 hover:text-white hover:bg-white/5 transition-colors text-[11px] font-bold uppercase tracking-widest"
                    >
                      Cancel
                    </button>
                  </div>`;

// Since it uses `{/* Action Buttons */}`, we match that
const regex3 = /\{\/\* Action Buttons \*\/\}.*?Confirm Payment Submitted.*?<\/button>.*?<\/button>.*?<\/div>/s;

code = code.replace(regex3, newButtons);
fs.writeFileSync('src/components/Contact.tsx', code);
