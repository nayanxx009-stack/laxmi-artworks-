const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const origEndpoint = `  app.post("/api/send-invoice", async (req, res) => {
    const { email, order, pdfBase64 } = req.body;
    if (!process.env.IMAP_USER || !process.env.IMAP_PASS) {
       return res.status(500).json({ success: false, error: 'Email credentials not configured' });
    }
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.IMAP_USER,
          pass: process.env.IMAP_PASS
        }
      });
      const mailOptions = {
        from: process.env.IMAP_USER,
        to: email,
        subject: \`Invoice for Order \${order.id}\`,
        text: \`Dear \${order.name},

Please find attached the invoice for your order \${order.id}.

Thank you,
Laxmi Artworks\`,
        attachments: [
          {
            filename: \`Invoice_\${order.id}.pdf\`,
            content: pdfBase64.split("base64,")[1],
            encoding: 'base64'
          }
        ]
      };
      await transporter.sendMail(mailOptions);
      res.json({ success: true });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message });
    }
  });`;

const replEndpoint = `  app.post("/api/send-invoice", async (req, res) => {
    const { email, order, pdfBase64 } = req.body;
    
    if (!email) {
       return res.status(400).json({ success: false, error: 'Customer email is missing.' });
    }
    
    // Validate email format
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (!emailRegex.test(email)) {
       return res.status(400).json({ success: false, error: 'Invalid customer email format.' });
    }
    
    const user = process.env.GMAIL_USER || process.env.IMAP_USER;
    const pass = process.env.GMAIL_APP_PASSWORD || process.env.IMAP_PASS;
    
    if (!user || !pass) {
       return res.status(500).json({ success: false, error: 'Email server credentials not configured.' });
    }
    
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: user,
          pass: pass
        }
      });
      
      const invoiceNumber = order.orderId || order.id?.substring(0, 8).toUpperCase();
      const amount = order.amount || '0';
      const status = order.paymentStatus || 'Pending';
      
      const mailOptions = {
        from: user,
        to: email,
        subject: \`Laxmi Artworks — Invoice \${invoiceNumber} for Order \${order.orderId || order.id}\`,
        text: \`Hello \${order.name || 'Customer'},

Thank you for choosing Laxmi Artworks.

Please find your invoice attached for Order \${order.orderId || order.id}.

Invoice: \${invoiceNumber}
Amount: ₹\${amount}
Payment Status: \${status}

For any questions, please contact:
support@laxmiartworks.com

Regards,
Laxmi Artworks
NECRONIC IND. PVT. LTD.
Tinsukia, Assam\`,
        attachments: [
          {
            filename: \`Invoice_\${order.orderId || order.id}.pdf\`,
            content: pdfBase64.split("base64,")[1],
            encoding: 'base64'
          }
        ]
      };
      
      await transporter.sendMail(mailOptions);
      res.json({ success: true });
    } catch (err: any) {
      console.error('Invoice send error:', err);
      res.status(500).json({ success: false, error: err.message || 'SMTP Connection failed or rejected.' });
    }
  });`;

if(code.includes(origEndpoint)) {
    code = code.replace(origEndpoint, replEndpoint);
    fs.writeFileSync('server.ts', code);
    console.log("Updated server.ts successfully");
} else {
    console.log("Could not find endpoint in server.ts");
}
