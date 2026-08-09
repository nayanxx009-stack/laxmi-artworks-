const fs = require('fs');
let code = fs.readFileSync('src/components/GlobalPopup.tsx', 'utf8');

if (!code.includes('createPortal')) {
    code = "import { createPortal } from 'react-dom';\n" + code;
}

const orig = `{isVisible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">`;

const replacement = `{isVisible && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">`;

code = code.replace(orig, replacement);

const endOrig = `</motion.div>
        </div>
      )}`;

const endRepl = `</motion.div>
        </div>,
        document.body
      )}`;

code = code.replace(endOrig, endRepl);
fs.writeFileSync('src/components/GlobalPopup.tsx', code);
