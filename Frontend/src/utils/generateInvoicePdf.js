/**
 * generateInvoicePdf.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Turns a SAVED invoice (the authoritative JSON returned by
 *   invoiceService, including its server-computed totals and
 *   application-assigned reference ID) into a downloadable PDF, drawn
 *   directly with jsPDF + jspdf-autotable.
 *
 * WHY THIS DRAWS SHAPES/TEXT DIRECTLY INSTEAD OF RASTERIZING HTML
 *   An earlier version of this function rendered the invoice as real
 *   HTML and photographed it with html2canvas before placing that image
 *   into the PDF -- in principle a pixel-accurate approach, but it
 *   introduced a hard dependency on html2canvas's browser-environment
 *   behavior (webfont timing, canvas tainting, off-screen layout) that
 *   turned out to be unreliable and broke downloads entirely for some
 *   invoices. Drawing directly with jsPDF's own text/rect/table
 *   primitives has no such runtime dependency -- every value is placed
 *   at an exact, calculated position, so if it works once for a given
 *   invoice shape, it works every time. This is the same approach this
 *   function used successfully before, refined for a closer match to
 *   the provided invoice template (dark header band, accent rule, a
 *   proper meta grid, and a stronger totals treatment).
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Colours matching the app's tailwind tokens (see tailwind.config.js).
const INK = [23, 20, 18];
const ACCENT = [210, 84, 10]; // brass
const ACCENT_LIGHT = [251, 239, 228];
const MUTED = [114, 107, 99];
const RULE = [235, 227, 216];
const SOFT_BG = [251, 247, 242];
const WHITE = [255, 255, 255];

function currencySymbol(code) {
  return { USD: '$', EUR: '\u20ac', GBP: '\u00a3', INR: '\u20b9', AUD: 'A$', CAD: 'C$' }[code] || `${code} `;
}

// jsPDF's addImage() needs to be told the image format explicitly -- it
// doesn't sniff it from the data itself. Uploaded logos/signatures could
// be PNG, JPEG, or WEBP depending on what the user picked, so we read it
// off the data URL's mime type instead of assuming PNG for everything
// (a mismatch here can render a blank/corrupted image in the PDF).
function detectImageFormat(dataUrl) {
  const match = /^data:image\/(\w+);base64,/.exec(dataUrl || '');
  const type = match ? match[1].toUpperCase() : 'PNG';
  if (type === 'JPG' || type === 'JPEG') return 'JPEG';
  if (['PNG', 'WEBP', 'BMP', 'GIF'].includes(type)) return type;
  return 'PNG';
}

// Wraps `addImage` in a try/catch -- a corrupt/unsupported data URL
// (rare, but possible from an old browser export) should never crash
// the whole PDF; worst case, that one image is skipped.
function safeAddImage(doc, dataUrl, x, y, w, h) {
  if (!dataUrl) return false;
  try {
    doc.addImage(dataUrl, detectImageFormat(dataUrl), x, y, w, h, undefined, 'FAST');
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[generateInvoicePdf] Failed to embed image, skipping it:', err);
    return false;
  }
}

/**
 * Renders the invoice and triggers a browser download named after its
 * reference ID. Synchronous (no fonts/images to wait on asynchronously)
 * -- kept as an async function so call sites that `await` it (in case a
 * future version needs to) don't need to change.
 */
export async function generateInvoicePdf(invoice) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;
  const currency = invoice.currency || 'USD';
  const sym = currencySymbol(currency);
  const fmt = (n) => `${sym}${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  const issuer = invoice.issuerDetails || {};

  // ======================================================================
  // HEADER BAND (dark, matches the reference template's .inv-header)
  // ======================================================================
  const headerHeight = 96;
  doc.setFillColor(...INK);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  const logoSize = 48;
  const logoX = margin;
  const logoY = (headerHeight - logoSize) / 2;
  let logoDrawn = false;
  if (invoice.logoDataUrl) {
    logoDrawn = safeAddImage(doc, invoice.logoDataUrl, logoX, logoY, logoSize, logoSize);
  }
  if (!logoDrawn) {
    doc.setFillColor(...ACCENT);
    doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 'F');
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...WHITE);
    const initials = (issuer.name || 'BM').trim().slice(0, 2).toUpperCase();
    doc.text(initials, logoX + logoSize / 2, logoY + logoSize / 2 + 5, { align: 'center' });
  }

  const textX = logoX + logoSize + 16;
  doc.setFont('times', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...WHITE);
  doc.text(issuer.name || 'Your Company', textX, logoY + 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255, 0.6);
  doc.setTextColor(190, 186, 180);
  const contactLines = [];
  if (issuer.address) contactLines.push(...doc.splitTextToSize(issuer.address, 260));
  const contactBits = [issuer.phone, issuer.email].filter(Boolean).join('   \u00b7   ');
  if (contactBits) contactLines.push(contactBits);
  doc.text(contactLines, textX, logoY + 32);

  // Ghost "INVOICE" watermark-style text, right-aligned in the header.
  doc.setFont('times', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(70, 65, 60);
  doc.text('INVOICE', pageWidth - margin, headerHeight / 2 + 9, { align: 'right', charSpace: 2 });

  // Accent rule under the header.
  doc.setFillColor(...ACCENT);
  doc.rect(0, headerHeight, pageWidth, 4, 'F');

  let y = headerHeight + 4;

  // ======================================================================
  // META GRID: Bill To | Reference / Issued / Due
  // ======================================================================
  const metaTop = y;
  const metaHeight = 78;
  const metaMidX = margin + contentWidth / 2;

  doc.setDrawColor(...RULE);
  doc.line(margin, metaTop + metaHeight, pageWidth - margin, metaTop + metaHeight);
  doc.line(metaMidX, metaTop + 14, metaMidX, metaTop + metaHeight - 14);

  // Left: Bill To
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...ACCENT);
  doc.text('BILL TO', margin, metaTop + 22);

  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text(invoice.clientName || '\u2014', margin, metaTop + 40);

  if (invoice.billToAddress) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    const addrLines = doc.splitTextToSize(invoice.billToAddress, contentWidth / 2 - 20);
    doc.text(addrLines.slice(0, 3), margin, metaTop + 54);
  }

  // Right: Reference / Issued / Due
  const rightX = metaMidX + 20;
  let metaRowY = metaTop + 22;
  const metaRow = (label, value) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(label, rightX, metaRowY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...INK);
    doc.text(String(value), pageWidth - margin, metaRowY, { align: 'right' });
    metaRowY += 17;
  };
  metaRow('Reference', invoice.referenceId || '');
  metaRow('Issued', invoice.issueDate || '');
  if (invoice.dueDate) metaRow('Due', invoice.dueDate);

  y = metaTop + metaHeight;

  // ======================================================================
  // SUBJECT BAR
  // ======================================================================
  if (invoice.subject) {
    doc.setFillColor(...SOFT_BG);
    doc.rect(0, y, pageWidth, 26, 'F');
    doc.setDrawColor(...RULE);
    doc.line(margin, y + 26, pageWidth - margin, y + 26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('SUBJECT', margin, y + 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(String(invoice.subject), margin + 60, y + 17);
    y += 26;
  }

  y += 16;

  // ======================================================================
  // LINE ITEMS TABLE
  // ======================================================================
  const items = invoice.lineItems || [];
  const tableRows = items.map((item, i) => [
    String(i + 1).padStart(2, '0'),
    item.note ? `${item.description}\n${item.note}` : item.description,
    String(item.quantity),
    fmt(item.rate),
    fmt(item.amount),
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['#', 'Description', 'Qty', 'Rate', 'Amount']],
    body: tableRows,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      textColor: INK,
      cellPadding: { top: 8, bottom: 8, left: 6, right: 6 },
      lineColor: RULE,
      lineWidth: 0.75,
    },
    headStyles: {
      fillColor: SOFT_BG,
      textColor: MUTED,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 26, textColor: MUTED, fontSize: 8.5 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 42, halign: 'right' },
      3: { cellWidth: 70, halign: 'right' },
      4: { cellWidth: 78, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      // The description column sometimes carries an extra "note" line
      // (joined with \n above) -- render it a touch smaller/muted so it
      // reads as a secondary line, matching the on-screen item note style.
      if (data.column.index === 1 && data.cell.section === 'body' && data.cell.raw.includes('\n')) {
        data.cell.styles.fontSize = 9.5;
      }
    },
  });

  y = doc.lastAutoTable.finalY + 16;

  // ======================================================================
  // TOTALS BOX (right-aligned)
  // ======================================================================
  const totalsWidth = 220;
  const totalsX = pageWidth - margin - totalsWidth;
  let totalsY = y;

  const totalsRow = (label, value, opts = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.fontSize || 10);
    doc.setTextColor(...(opts.color || MUTED));
    doc.text(label, totalsX, totalsY);
    doc.setTextColor(...(opts.valueColor || INK));
    doc.text(value, totalsX + totalsWidth, totalsY, { align: 'right' });
    if (!opts.noRule) {
      doc.setDrawColor(...RULE);
      doc.line(totalsX, totalsY + 6, totalsX + totalsWidth, totalsY + 6);
    }
    totalsY += 22;
  };

  totalsRow('Subtotal', fmt(invoice.subtotalAmount));
  if (invoice.gstApplicable) {
    totalsRow(`GST (${invoice.gstPercentage}%)`, fmt(invoice.gstAmount));
  }
  totalsY += 4;
  doc.setDrawColor(...INK);
  doc.setLineWidth(1.2);
  doc.line(totalsX, totalsY - 14, totalsX + totalsWidth, totalsY - 14);
  doc.setLineWidth(0.75);
  totalsRow(`TOTAL (${currency})`, fmt(invoice.totalAmount), {
    bold: true,
    fontSize: 12,
    color: INK,
    valueColor: ACCENT,
    noRule: true,
  });

  y = totalsY + 10;

  // ======================================================================
  // AMOUNT IN WORDS
  // ======================================================================
  if (invoice.amountInWords) {
    const wordsLines = doc.splitTextToSize(`${invoice.amountInWords} Only`, contentWidth - 24);
    const boxHeight = 18 + wordsLines.length * 13;
    doc.setFillColor(...ACCENT_LIGHT);
    doc.rect(margin, y, contentWidth, boxHeight, 'F');
    doc.setFillColor(...ACCENT);
    doc.rect(margin, y, 3, boxHeight, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...ACCENT);
    doc.text('AMOUNT IN WORDS', margin + 16, y + 14);
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    doc.text(wordsLines, margin + 16, y + 29);
    y += boxHeight + 20;
  } else {
    y += 10;
  }

  // ======================================================================
  // FOOTER: Notes/Terms | Bank details
  // ======================================================================
  const hasNotesOrTerms = invoice.notes || invoice.terms;
  const hasBankDetails = issuer.bankName || issuer.accountNumber || issuer.ifscOrSwift;

  if (hasNotesOrTerms || hasBankDetails) {
    doc.setDrawColor(...RULE);
    doc.line(margin, y, pageWidth - margin, y);
    y += 20;

    const colWidth = contentWidth / 2 - 16;
    let leftY = y;
    if (invoice.notes) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text('NOTES', margin, leftY);
      leftY += 13;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      const noteLines = doc.splitTextToSize(invoice.notes, colWidth);
      doc.text(noteLines, margin, leftY);
      leftY += noteLines.length * 12 + 14;
    }
    if (invoice.terms) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text('TERMS & CONDITIONS', margin, leftY);
      leftY += 13;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      const termLines = doc.splitTextToSize(invoice.terms, colWidth);
      doc.text(termLines, margin, leftY);
      leftY += termLines.length * 12;
    }

    if (hasBankDetails) {
      const bankX = margin + contentWidth / 2 + 16;
      let bankY = y;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text('BANK DETAILS', bankX, bankY);
      bankY += 13;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      if (issuer.bankName) {
        doc.text(issuer.bankName, bankX, bankY);
        bankY += 13;
      }
      if (issuer.accountNumber) {
        doc.text(`A/C: ${issuer.accountNumber}`, bankX, bankY);
        bankY += 13;
      }
      if (issuer.ifscOrSwift) {
        doc.text(`IFSC/SWIFT: ${issuer.ifscOrSwift}`, bankX, bankY);
        bankY += 13;
      }
      leftY = Math.max(leftY, bankY);
    }

    y = leftY + 16;
  }

  // ======================================================================
  // SIGNATURE
  // ======================================================================
  const sigWidth = 150;
  const sigX = pageWidth - margin - sigWidth;
  let sigDrawn = false;
  if (invoice.signatureDataUrl) {
    sigDrawn = safeAddImage(doc, invoice.signatureDataUrl, sigX, y, sigWidth, 42);
  }
  const sigLineY = y + (sigDrawn ? 48 : 34);
  doc.setDrawColor(...INK);
  doc.line(sigX, sigLineY, sigX + sigWidth, sigLineY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text(invoice.signatureName || 'Authorized Signatory', sigX + sigWidth, sigLineY + 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text('AUTHORIZED SIGNATORY', sigX + sigWidth, sigLineY + 25, { align: 'right' });

  // ======================================================================
  // BOTTOM BAND
  // ======================================================================
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomBandY = pageHeight - 34;
  doc.setFillColor(...SOFT_BG);
  doc.rect(0, bottomBandY, pageWidth, 34, 'F');
  doc.setDrawColor(...RULE);
  doc.line(0, bottomBandY, pageWidth, bottomBandY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  const bottomLeft = [issuer.name, issuer.email].filter(Boolean).join('  \u00b7  ') || 'Brew Minds';
  doc.text(bottomLeft, margin, bottomBandY + 20);
  doc.setFont('times', 'italic');
  doc.text('Generated with Brew Minds', pageWidth - margin, bottomBandY + 20, { align: 'right' });

  doc.save(`${invoice.referenceId || 'invoice'}.pdf`);
}
