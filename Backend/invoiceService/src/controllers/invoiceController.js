/**
 * invoiceController.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Implements the Invoice section: a pre-built template the user fills
 *   in (issuer details, subject, bill-to address, items, GST, currency,
 *   notes/terms, an optional logo and signature image), with an
 *   application-assigned reference ID the user cannot edit, and
 *   server-computed totals + amount-in-words so a tampered client
 *   request can never save incorrect numbers.
 *
 *   PDF generation itself happens on the FRONTEND (jsPDF) once an
 *   invoice is saved -- this endpoint just returns the authoritative,
 *   final invoice JSON the frontend renders into a PDF matching the
 *   client-provided invoice template.
 */

const { query } = require('../config/db');
const { invoiceSchema } = require('../utils/validation');
const { generateReferenceId } = require('../utils/referenceId');
const { numberToWords } = require('../utils/numberToWords');

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Recomputes subtotal / GST / total from line items -- NEVER trusts a
// total sent by the client, always derives it from quantity * rate.
function computeTotals(lineItems, gstApplicable, gstPercentage) {
  const itemsWithAmount = lineItems.map((item) => ({
    ...item,
    amount: round2(item.quantity * item.rate),
  }));
  const subtotal = round2(itemsWithAmount.reduce((sum, item) => sum + item.amount, 0));
  const gstAmount = gstApplicable ? round2((subtotal * gstPercentage) / 100) : 0;
  const total = round2(subtotal + gstAmount);
  return { itemsWithAmount, subtotal, gstAmount, total };
}

function toInvoiceDto(row) {
  return {
    id: row.id,
    referenceId: row.reference_id,
    clientId: row.client_id,
    clientName: row.client_name || null,
    projectId: row.project_id,
    projectName: row.project_name || null,
    issuerDetails: row.issuer_details,
    lineItems: row.line_items,
    currency: row.currency,
    gstApplicable: row.gst_applicable,
    gstPercentage: Number(row.gst_percentage),
    subtotalAmount: Number(row.subtotal_amount),
    gstAmount: Number(row.gst_amount),
    totalAmount: Number(row.total_amount),
    amountInWords: row.amount_in_words,
    status: row.status,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    subject: row.subject,
    billToAddress: row.bill_to_address,
    notes: row.notes,
    terms: row.terms,
    logoDataUrl: row.logo_data_url,
    signatureDataUrl: row.signature_data_url,
    signatureName: row.signature_name,
    createdAt: row.created_at,
  };
}

const BASE_SELECT = `
  SELECT inv.*, c.name AS client_name, p.name AS project_name
  FROM invoices inv
  LEFT JOIN clients c ON c.id = inv.client_id
  LEFT JOIN projects p ON p.id = inv.project_id
`;

/** GET /api/invoices -- searchable/filterable list */
async function list(req, res) {
  const { search, status, clientId } = req.query;
  const conditions = ['inv.user_id = $1'];
  const params = [req.user.id];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(inv.reference_id ILIKE $${params.length} OR c.name ILIKE $${params.length})`);
  }
  if (status) {
    params.push(status);
    conditions.push(`inv.status = $${params.length}`);
  }
  if (clientId) {
    params.push(clientId);
    conditions.push(`inv.client_id = $${params.length}`);
  }

  const result = await query(
    `${BASE_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY inv.created_at DESC`,
    params
  );
  res.json({ invoices: result.rows.map(toInvoiceDto) });
}

/** GET /api/invoices/:id -- full detail, used to render/download the PDF */
async function getOne(req, res) {
  const result = await query(`${BASE_SELECT} WHERE inv.id = $1 AND inv.user_id = $2`, [
    req.params.id,
    req.user.id,
  ]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found.' });
  res.json({ invoice: toInvoiceDto(result.rows[0]) });
}

/** POST /api/invoices -- "Save" button */
async function create(req, res) {
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const d = parsed.data;

  const { itemsWithAmount, subtotal, gstAmount, total } = computeTotals(
    d.lineItems,
    d.gstApplicable,
    d.gstPercentage
  );
  const amountInWords = numberToWords(total);
  const referenceId = await generateReferenceId(req.user.id);

  const result = await query(
    `INSERT INTO invoices
       (user_id, client_id, project_id, reference_id, issuer_details, line_items, currency,
        gst_applicable, gst_percentage, subtotal_amount, gst_amount, total_amount,
        amount_in_words, status, issue_date, due_date,
        subject, bill_to_address, notes, terms, logo_data_url, signature_data_url, signature_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,COALESCE($15, CURRENT_DATE),$16,
             $17,$18,$19,$20,$21,$22,$23)
     RETURNING id`,
    [
      req.user.id,
      d.clientId,
      d.projectId || null,
      referenceId,
      JSON.stringify(d.issuerDetails),
      JSON.stringify(itemsWithAmount),
      d.currency,
      d.gstApplicable,
      d.gstPercentage,
      subtotal,
      gstAmount,
      total,
      amountInWords,
      d.status || 'saved',
      d.issueDate || null,
      d.dueDate || null,
      d.subject || null,
      d.billToAddress || null,
      d.notes || null,
      d.terms || null,
      d.logoDataUrl || null,
      d.signatureDataUrl || null,
      d.signatureName || null,
    ]
  );

  const full = await query(`${BASE_SELECT} WHERE inv.id = $1`, [result.rows[0].id]);
  res.status(201).json({ invoice: toInvoiceDto(full.rows[0]) });
}

/**
 * PUT /api/invoices/:id
 * Everything is editable EXCEPT reference_id -- it's simply never
 * accepted as an input field, so there is no way for a client request
 * to change it (see validation.js -- referenceId is not even in the schema).
 */
async function update(req, res) {
  const parsed = invoiceSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const d = parsed.data;

  const existing = await query('SELECT * FROM invoices WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.user.id,
  ]);
  if (existing.rows.length === 0) return res.status(404).json({ error: 'Invoice not found.' });
  const current = existing.rows[0];

  const lineItems = d.lineItems || current.line_items;
  const gstApplicable = d.gstApplicable ?? current.gst_applicable;
  const gstPercentage = d.gstPercentage ?? Number(current.gst_percentage);
  const { itemsWithAmount, subtotal, gstAmount, total } = computeTotals(
    lineItems,
    gstApplicable,
    gstPercentage
  );
  const amountInWords = numberToWords(total);

  const result = await query(
    `UPDATE invoices SET
        client_id = COALESCE($1, client_id),
        project_id = COALESCE($2, project_id),
        issuer_details = COALESCE($3, issuer_details),
        line_items = $4,
        currency = COALESCE($5, currency),
        gst_applicable = $6,
        gst_percentage = $7,
        subtotal_amount = $8,
        gst_amount = $9,
        total_amount = $10,
        amount_in_words = $11,
        status = COALESCE($12, status),
        due_date = COALESCE($13, due_date),
        subject = COALESCE($14, subject),
        bill_to_address = COALESCE($15, bill_to_address),
        notes = COALESCE($16, notes),
        terms = COALESCE($17, terms),
        logo_data_url = COALESCE($18, logo_data_url),
        signature_data_url = COALESCE($19, signature_data_url),
        signature_name = COALESCE($20, signature_name)
     WHERE id = $21 AND user_id = $22 RETURNING id`,
    [
      d.clientId, d.projectId,
      d.issuerDetails ? JSON.stringify(d.issuerDetails) : null,
      JSON.stringify(itemsWithAmount),
      d.currency, gstApplicable, gstPercentage, subtotal, gstAmount, total, amountInWords,
      d.status, d.dueDate, d.subject, d.billToAddress, d.notes, d.terms,
      d.logoDataUrl, d.signatureDataUrl, d.signatureName,
      req.params.id, req.user.id,
    ]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found.' });

  const full = await query(`${BASE_SELECT} WHERE inv.id = $1`, [req.params.id]);
  res.json({ invoice: toInvoiceDto(full.rows[0]) });
}

/** DELETE /api/invoices/:id */
async function remove(req, res) {
  const result = await query('DELETE FROM invoices WHERE id = $1 AND user_id = $2 RETURNING id', [
    req.params.id,
    req.user.id,
  ]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found.' });
  res.status(204).send();
}

module.exports = { list, getOne, create, update, remove };
