const fs = require('fs');

const code = `import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const generateInvoice = async (order: any, type: 'download' | 'email' = 'download') => {
  const doc = new jsPDF();
  
  // Premium Colors
  const darkCharcoal = '#1a1a1a';
  const lightGray = '#f8f8f8';
  const midGray = '#888888';
  const gold = '#c69c6d';
  const textColor = '#333333';
  
  const invoiceNumber = order.orderId || order.id?.substring(0, 8).toUpperCase();
  const issueDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  
  let paymentStatusStr = 'PENDING';
  let paymentStatusColor = '#f59e0b'; // Amber
  if (order.paymentStatus === 'Paid') {
    paymentStatusStr = 'PAID';
    paymentStatusColor = '#10b981'; // Green
  } else if (order.paymentStatus === 'Verified') {
    paymentStatusStr = 'PARTIALLY PAID';
    paymentStatusColor = '#3b82f6'; // Blue
  } else if (order.paymentStatus === 'Cancelled' || order.status === 'Cancelled') {
    paymentStatusStr = 'CANCELLED';
    paymentStatusColor = '#ef4444'; // Red
  }

  // --- HEADER ---
  // Top Banner
  doc.setFillColor(26, 26, 26); // dark charcoal
  doc.rect(0, 0, 210, 8, 'F');
  
  doc.setFillColor(198, 156, 109); // gold
  doc.rect(0, 8, 210, 2, 'F');
  
  // Company Info
  doc.setTextColor(26, 26, 26);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("LAXMI ARTWORKS", 14, 28);
  
  doc.setTextColor(136, 136, 136);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Custom Art • Portraits • Creative Works", 15, 34);

  // Address
  doc.setTextColor(51, 51, 51);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("HEADQUARTERS:", 140, 24);
  
  doc.setFont("helvetica", "normal");
  doc.text("NECRONIC IND. PVT. LTD.", 140, 28);
  doc.text("Gelapukhuri Road", 140, 32);
  doc.text("Near Chanmari Tiniali", 140, 36);
  doc.text("Tinsukia, Assam, India", 140, 40);

  // Divider
  doc.setDrawColor(230, 230, 230);
  doc.line(14, 48, 196, 48);

  // --- INVOICE DETAILS ---
  doc.setTextColor(26, 26, 26);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", 14, 62);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Invoice Number:", 140, 56);
  doc.text("Issue Date:", 140, 62);
  doc.text("Order ID:", 140, 68);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(invoiceNumber, 170, 56);
  doc.text(issueDate, 170, 62);
  doc.text(order.id, 170, 68);

  // STATUS BADGE
  doc.setFillColor(paymentStatusColor);
  doc.rect(14, 66, 35, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(paymentStatusStr, 31.5, 70.5, { align: 'center' });

  // --- BILL TO ---
  doc.setTextColor(26, 26, 26);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO:", 14, 85);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(textColor);
  doc.text(order.name || 'Customer Name', 14, 91);
  if (order.email) doc.text(order.email, 14, 96);
  if (order.phone) doc.text(order.phone, 14, 101);
  if (order.address) {
    const splitAddress = doc.splitTextToSize(order.address, 80);
    doc.text(splitAddress, 14, 106);
  }

  // --- ORDER ITEMS TABLE ---
  const totalAmount = Number(order.amount) || 0;
  
  // Create table data based on what's available
  const tableData = [
    [
      \`Custom Artwork - \${order.size || 'Standard'}\nMedium: \${order.medium || 'N/A'}\nFraming: \${order.framing || 'N/A'}\nSubject: \${order.subject || 'N/A'}\`,
      "1",
      \`\${totalAmount.toLocaleString('en-IN')}\`,
      \`\${totalAmount.toLocaleString('en-IN')}\`
    ]
  ];

  (doc as any).autoTable({
    startY: 120,
    head: [['Description', 'Qty', 'Unit Price (INR)', 'Total (INR)']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: [248, 248, 248],
      textColor: [26, 26, 26],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left'
    },
    bodyStyles: {
      textColor: [51, 51, 51],
      fontSize: 9,
      cellPadding: 6,
    },
    columnStyles: {
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 35 }
    },
    didDrawCell: function(data: any) {
      if (data.row.section === 'head') {
        doc.setDrawColor(200, 200, 200);
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
      if (data.row.section === 'body') {
        doc.setDrawColor(230, 230, 230);
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY || 150;
  
  // --- PAYMENT SUMMARY ---
  const summaryX = 130;
  const valX = 196;
  let currY = finalY + 15;
  
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  
  doc.text("Subtotal", summaryX, currY);
  doc.text(\`₹\${totalAmount.toLocaleString('en-IN')}\`, valX, currY, { align: 'right' });
  
  currY += 7;
  doc.text("Discount", summaryX, currY);
  doc.text("-₹0", valX, currY, { align: 'right' });
  
  currY += 7;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 26, 26);
  doc.text("TOTAL", summaryX, currY);
  doc.text(\`₹\${totalAmount.toLocaleString('en-IN')}\`, valX, currY, { align: 'right' });

  // Paid & Balance
  currY += 10;
  doc.setDrawColor(230, 230, 230);
  doc.line(summaryX, currY - 5, valX, currY - 5);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Amount Paid", summaryX, currY);
  
  let amountPaid = 0;
  if (paymentStatusStr === 'PAID') amountPaid = totalAmount;
  else if (paymentStatusStr === 'PARTIALLY PAID') amountPaid = totalAmount / 2;
  
  doc.text(\`₹\${amountPaid.toLocaleString('en-IN')}\`, valX, currY, { align: 'right' });
  
  currY += 7;
  const balance = totalAmount - amountPaid;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(198, 156, 109); // gold
  doc.text("Balance Due", summaryX, currY);
  doc.text(\`₹\${balance.toLocaleString('en-IN')}\`, valX, currY, { align: 'right' });

  // --- FOOTER ---
  const pageHeight = doc.internal.pageSize.height;
  
  doc.setFillColor(248, 248, 248);
  doc.rect(0, pageHeight - 35, 210, 35, 'F');
  
  doc.setDrawColor(198, 156, 109);
  doc.line(0, pageHeight - 35, 210, pageHeight - 35);
  
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  
  doc.text("Thank you for choosing Laxmi Artworks.", 14, pageHeight - 22);
  doc.text("Every artwork is created with care and attention to detail.", 14, pageHeight - 17);
  
  doc.text("support@laxmiartworks.com", 196, pageHeight - 22, { align: 'right' });
  doc.text("www.laxmiartworks.com", 196, pageHeight - 17, { align: 'right' });

  if (type === 'download') {
    doc.save(\`Invoice_\${invoiceNumber}.pdf\`);
  } else if (type === 'email') {
    const pdfBase64 = doc.output('datauristring');
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: order.email, order, pdfBase64 })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send invoice');
      }
    } catch (e: any) {
      throw new Error(e.message || 'Error sending invoice');
    }
  }
};
`;

fs.writeFileSync('src/lib/generateInvoice.ts', code);
