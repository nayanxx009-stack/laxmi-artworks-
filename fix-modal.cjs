const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const orig = `<AnimatePresence>
        {selectedOrder && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">`;

const repl = `{typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedOrder && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">`;

code = code.replace(orig, repl);

const origEnd = `                </div>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>`;

const replEnd = `                </div>
              </div>
            </motion.div>
          </div>
          )}
        </AnimatePresence>,
        document.body
      )}`;

code = code.replace(origEnd, replEnd);
fs.writeFileSync('src/components/AdminPanel.tsx', code);
