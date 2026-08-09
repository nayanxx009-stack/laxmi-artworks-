const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const regex = /<AnimatePresence>\s*\{saveSuccessMessage && typeof document !== 'undefined' && createPortal\(\s*<motion\.div\s*initial=\{\{ opacity: 0, y: 50 \}\}\s*animate=\{\{ opacity: 1, y: 0 \}\}\s*exit=\{\{ opacity: 0, y: 50 \}\}\s*className="fixed bottom-6 right-6 z-\[200\] bg-neutral-900 border border-white\/10 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3"\s*>\s*\{saveSuccessMessage\}\s*<\/motion\.div>,\s*document\.body\s*\)\}\s*<\/AnimatePresence>/;

const replacement = `<AnimatePresence>
        {saveSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 right-6 z-[200] bg-neutral-900 border border-white/10 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3"
          >
            {saveSuccessMessage}
          </motion.div>
        )}
      </AnimatePresence>`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/components/AdminPanel.tsx', code);
