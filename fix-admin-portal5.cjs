const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const regex = /\{saveSuccessMessage && \(\s*<motion\.div\s*initial=\{\{ opacity: 0, y: 50 \}\}\s*animate=\{\{ opacity: 1, y: 0 \}\}\s*exit=\{\{ opacity: 0, y: 50 \}\}\s*className="fixed bottom-6 right-6 z-\[200\] bg-neutral-900 border border-white\/10 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3"\s*>\s*\{saveSuccessMessage\}\s*<\/motion\.div>\s*\)\}/;

const replacement = `{saveSuccessMessage && typeof document !== 'undefined' && createPortal(
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 right-6 z-[200] bg-neutral-900 border border-white/10 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3"
          >
            {saveSuccessMessage}
          </motion.div>,
          document.body
        )}`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/components/AdminPanel.tsx', code);
