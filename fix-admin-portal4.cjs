const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const regex = /<\/motion\.div>\n\s*<\/div>\n\s*\)\}\n\s*<\/AnimatePresence>\n\s*<AnimatePresence>\n\s*\{saveSuccessMessage/;
const replacement = `</motion.div>\n          </div>,\n          document.body\n        )}\n      </AnimatePresence>\n                \n      <AnimatePresence>\n        {saveSuccessMessage`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/components/AdminPanel.tsx', code);
