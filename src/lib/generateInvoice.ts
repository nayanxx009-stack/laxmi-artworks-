import { jsPDF } from 'jspdf';
import 'jspdf-autotable'; 

export const generateInvoice = async (order: any, type: 'download' | 'email' = 'download') => {
  const doc = new jsPDF();
  
  // Professional Black & Gold Colors
  const black = '#000000';
  const darkGray = '#111111';
  const gold = '#d4af37'; // Classic gold
  const lightGold = '#f3e5ab';
  const textColor = '#333333';

  // --- HEADER (Black Background) ---
  doc.setFillColor(0, 0, 0); // Black
  doc.rect(0, 0, 210, 45, 'F');
  
  // Gold accent line
  doc.setFillColor(212, 175, 55); // Gold
  doc.rect(0, 45, 210, 2, 'F');

  // Company Name / Logo
  doc.setTextColor(212, 175, 55); // Gold
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.text("LAXMI ARTWORKS", 14, 25);
  
  // Company Address & Info
  doc.setTextColor(255, 255, 255); // White
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("123 Art Studio Lane, Creative District", 14, 32);
  doc.text("Mumbai, Maharashtra 400001, India", 14, 37);
  doc.text("GSTIN: 27AAAAA1234A1Z5", 14, 42); // Optional GST field

  // Invoice Title
  doc.setTextColor(212, 175, 55); // Gold
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", 196, 25, { align: 'right' });
  
  doc.setTextColor(200, 200, 200); // Light gray
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`INV-${order.orderId || order.id?.substring(0, 8).toUpperCase()}`, 196, 32, { align: 'right' });
  doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`, 196, 37, { align: 'right' });

  // --- BILL TO SECTION ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO:", 14, 65);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(textColor);
  doc.text(order.name || 'Customer', 14, 72);
  doc.text(order.email || 'N/A', 14, 77);
  doc.text(order.phone || 'N/A', 14, 82);
  if (order.address) {
    const splitAddress = doc.splitTextToSize(order.address, 70);
    doc.text(splitAddress, 14, 87);
  }

  // --- ORDER INFO SECTION ---
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("ORDER INFO:", 120, 65);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(textColor);
  doc.text(`Order ID: ${order.orderId || order.id}`, 120, 72);
  doc.text(`Status: ${order.status || 'N/A'}`, 120, 77);
  doc.text(`Payment: ${order.paymentStatus || 'Pending'}`, 120, 82);
  if (order.courierPartner) {
    doc.text(`Courier: ${order.courierPartner}`, 120, 87);
  }
  if (order.trackingId) {
    doc.text(`Tracking ID: ${order.trackingId}`, 120, 92);
  }

  // --- ITEMS / ARTWORK DETAILS ---
  doc.setFillColor(17, 17, 17); // Dark gray header
  doc.rect(14, 110, 182, 12, 'F');
  
  doc.setTextColor(212, 175, 55); // Gold text
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DESCRIPTION", 18, 118);
  doc.text("TOTAL", 180, 118, { align: 'right' });

  // Items
  let y = 132;
  doc.setTextColor(textColor);
  doc.setFont("helvetica", "bold");
  doc.text(`Custom Artwork - ${order.size || 'Standard Size'}`, 18, y);
  
  doc.setFont("helvetica", "normal");
  const specs = `Subject: ${order.subject || 'N/A'}
Medium: ${order.medium || 'N/A'}
Framing: ${order.framing || 'N/A'}`;
  
  const splitSpecs = doc.splitTextToSize(specs, 140);
  doc.text(splitSpecs, 18, y + 6);
  
  doc.text(`INR ${order.amount || 0}`, 180, y, { align: 'right' });
  
  y += 30;

  // --- CALCULATIONS ---
  const total = Number(order.amount) || 0;
  const advance = total * 0.5;
  const remaining = total - advance;

  doc.setDrawColor(212, 175, 55); // Gold line
  doc.line(120, y, 196, y);
  
  y += 8;
  doc.text("Subtotal:", 120, y);
  doc.text(`INR ${total}`, 196, y, { align: 'right' });
  
  y += 8;
  doc.text("Advance Paid (50%):", 120, y);
  doc.text(`INR ${advance}`, 196, y, { align: 'right' });
  
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Remaining Balance:", 120, y);
  doc.setTextColor(212, 175, 55); // Highlight remaining in gold
  doc.text(`INR ${remaining}`, 196, y, { align: 'right' });

  // --- FOOTER ---
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 270, 210, 27, 'F');
  
  doc.setTextColor(212, 175, 55);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("THANK YOU FOR YOUR BUSINESS", 105, 278, { align: "center" });
  
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("For any inquiries, please contact us at support@laxmiartworks.com", 105, 284, { align: "center" });
  doc.text("www.laxmiartworks.com", 105, 289, { align: "center" });

  if (type === 'download') {
    doc.save(`Invoice_${order.orderId || order.id}.pdf`);
  } else if (type === 'email') {
    const pdfBase64 = doc.output('datauristring');
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: order.email, order, pdfBase64 })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to send invoice');
      }
    } catch (e: any) {
      throw new Error(e.message || 'Error sending invoice');
    }
  }
};
