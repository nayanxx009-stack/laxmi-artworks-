const fs = require('fs');

let code = fs.readFileSync('src/lib/generateInvoice.ts', 'utf8');

code = code.replace(
  "import 'jspdf-autotable';",
  "import autoTable from 'jspdf-autotable';"
);

code = code.replace(
  "(doc as any).autoTable({",
  "autoTable(doc, {"
);

code = code.replace(
  "const finalY = (doc as any).lastAutoTable.finalY || 150;",
  "const finalY = (doc as any).lastAutoTable?.finalY || 150;"
);

fs.writeFileSync('src/lib/generateInvoice.ts', code);
