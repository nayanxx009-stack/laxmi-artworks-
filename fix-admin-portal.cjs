const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

if (!code.includes('createPortal')) {
  code = code.replace(/import \{ ([^}]+) \} from "react";/, 'import { $1, useState } from "react";\nimport { createPortal } from "react-dom";');
  if (!code.includes('import { createPortal }')) {
     code = "import { createPortal } from 'react-dom';\n" + code;
  }
}

const signoutRegex = /\{showSignOutConfirm && \([\s\S]*?<div className="fixed inset-0 z-\[100\][\s\S]*?<\/div>\n\s*\}\)/;
const match = code.match(signoutRegex);
if (match) {
  const newSignout = match[0].replace(
    /\{showSignOutConfirm && \(\s*(<div className="fixed inset-0 z-\[100\][\s\S]*?<\/div>\s*<\/div>\s*)\)\}/,
    `{showSignOutConfirm && createPortal(\n        $1, document.body\n      )}`
  );
  code = code.replace(signoutRegex, newSignout);
}

fs.writeFileSync('src/components/AdminPanel.tsx', code);
