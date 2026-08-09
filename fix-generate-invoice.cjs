const fs = require('fs');
let code = fs.readFileSync('src/lib/generateInvoice.ts', 'utf8');

code = code.replace(
  /if \(data\.success\) \{[\s\S]*?alert\('Error sending invoice: ' \+ e\.message\);\n    \}/,
  `if (!data.success) {
        throw new Error(data.error || 'Failed to send invoice');
      }
    } catch (e: any) {
      throw new Error(e.message || 'Error sending invoice');
    }`
);

fs.writeFileSync('src/lib/generateInvoice.ts', code);
