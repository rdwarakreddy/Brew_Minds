/**
 * validation.js
 * ---------------------------------------------------------------------
 * Defines the valid shape of a lead and the six allowed Kanban columns.
 * Keeping the enum here (and matching the Postgres ENUM in the schema)
 * means an invalid status is rejected before it ever reaches the DB.
 */

const { z } = require('zod');

const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost'];

const leadSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email('Enter a valid email').max(255).optional().nullable().or(z.literal('')),
  country: z.string().trim().max(100).optional().nullable(),
  estimatedBudget: z.number().nonnegative().optional().nullable(),
  status: z.enum(LEAD_STATUSES).optional(),
  currency: z.string().trim().max(10).optional(),
  source: z.string().trim().max(100).optional().nullable(),
  nextFollowupAt: z.string().optional().nullable(), // ISO datetime string from the datetime picker
  notes: z.string().max(5000).optional().nullable(),
});

// Used by the drag-and-drop endpoint: only status + position change.
const moveLeadSchema = z.object({
  status: z.enum(LEAD_STATUSES),
  boardPosition: z.number().int().nonnegative(),
});

module.exports = { leadSchema, moveLeadSchema, LEAD_STATUSES };
