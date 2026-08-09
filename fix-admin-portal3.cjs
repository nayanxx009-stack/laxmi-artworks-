const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const modalStart = `{selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">`;

const replaceStart = `{selectedOrder && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">`;

if (code.includes(modalStart)) {
   code = code.replace(modalStart, replaceStart);
   // Need to replace the closing tag as well
   // We know it ends right before {showPopupPreview
   
   const endMatch = code.match(/<\/motion\.div>\n\s*<\/div>\n\s*\)\}\n\n\s*\{\/\* ADMINS TAB \*\/\}/);
   if (endMatch) {
      code = code.replace(/<\/motion\.div>\n\s*<\/div>\n\s*\)\}\n\n\s*\{\/\* ADMINS TAB \*\/\}/, 
      `</motion.div>\n          </div>,\n          document.body\n        )}\n\n        {/* ADMINS TAB */}`);
   }
   
   fs.writeFileSync('src/components/AdminPanel.tsx', code);
   console.log("Replaced global modal!");
} else {
   console.log("Could not find global modal start");
}
