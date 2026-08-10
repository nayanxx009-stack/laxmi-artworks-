const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');
const origTransporter = `      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: user,
          pass: pass
        }
      });`;
const replTransporter = `      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: user,
          pass: pass
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 15000
      });`;
if (serverCode.includes(origTransporter)) {
   serverCode = serverCode.replace(origTransporter, replTransporter);
   fs.writeFileSync('server.ts', serverCode);
   console.log("Updated server.ts transporter");
}

let panelCode = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');
const origFetch = `const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/send-invoice', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: selectedOrder.email, order: selectedOrder, pdfBase64 })
                          });`;
const replFetch = `
                          const controller = new AbortController();
                          const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
                          
                          const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/send-invoice', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: selectedOrder.email, order: selectedOrder, pdfBase64 }),
                            signal: controller.signal
                          });
                          clearTimeout(timeoutId);`;
if (panelCode.includes(origFetch)) {
   panelCode = panelCode.replace(origFetch, replFetch);
   fs.writeFileSync('src/components/AdminPanel.tsx', panelCode);
   console.log("Updated AdminPanel fetch");
}
