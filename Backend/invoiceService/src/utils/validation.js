const { z } = require('zod');

const lineItemSchema = z.object({
  description: z.string().trim().min(1, 'Item description is required').max(300),
  // Optional secondary line under the description (e.g. "with 1 year warranty"),
  // matching the client-provided invoice template's item-note field.
  note: z.string().trim().max(300).optional().default(''),
  quantity: z.number().positive('Quantity must be greater than 0'),
  rate: z.number().nonnegative('Rate cannot be negative'),
});

const issuerDetailsSchema = z.object({
  name: z.string().trim().max(150).optional().default(''),
  address: z.string().trim().max(500).optional().default(''),
  phone: z.string().trim().max(30).optional().default(''),
  email: z.string().trim().max(255).optional().default(''),
  bankName: z.string().trim().max(150).optional().default(''),
  accountNumber: z.string().trim().max(50).optional().default(''),
  ifscOrSwift: z.string().trim().max(50).optional().default(''),
});

const invoiceSchema = z.object({
  clientId: z.string().uuid('Select a client'),
  projectId: z.string().uuid().optional().nullable(),
  issuerDetails: issuerDetailsSchema,
  lineItems: z.array(lineItemSchema).min(1, 'Add at least one item'),
  currency: z.string().trim().min(1).max(10).default('USD'),
  gstApplicable: z.boolean().default(false),
  gstPercentage: z.number().min(0).max(100).default(0),
  issueDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  status: z.enum(['draft', 'saved', 'paid']).optional(),
  // ---- Fields matching the client-provided invoice template ------------
  subject: z.string().trim().max(300).optional().default(''),
  billToAddress: z.string().trim().max(500).optional().default(''),
  notes: z.string().trim().max(2000).optional().default(''),
  terms: z.string().trim().max(2000).optional().default(''),
  // Uploaded images, sent as base64 data URLs. Capped generously but
  // finitely so a request can't carry an unreasonably large payload.
  logoDataUrl: z.string().max(2_000_000).optional().nullable(),
  signatureDataUrl: z.string().max(2_000_000).optional().nullable(),
  signatureName: z.string().trim().max(150).optional().default(''),
});

module.exports = { invoiceSchema };
