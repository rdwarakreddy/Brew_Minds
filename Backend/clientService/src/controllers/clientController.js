/**
 * clientController.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   CRUD for clients, plus a `metrics` endpoint for the summary cards
 *   at the top of the Clients section (Total Clients, Total Projects,
 *   Ongoing, Completed). Because `projects` belongs to projectService
 *   in a "pure" microservice split, but both services share ONE
 *   Postgres database, we can query the projects table directly here
 *   with a simple JOIN -- pragmatic and fast for this app's scale. If
 *   this were split into separate databases later, this endpoint would
 *   instead call projectService's API and combine the results.
 */

const { z } = require('zod');
const { query } = require('../config/db');

const clientSchema = z.object({
  name: z.string().trim().min(1, 'Client name is required').max(150),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email('Enter a valid email').max(255).optional().nullable().or(z.literal('')),
  invoiceCurrency: z.string().trim().max(10).optional(),
  country: z.string().trim().max(100).optional().nullable(),
});

function toClientDto(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    invoiceCurrency: row.invoice_currency,
    country: row.country,
    lastPayment:
      row.last_payment_amount !== undefined && row.last_payment_amount !== null
        ? { amount: Number(row.last_payment_amount), date: row.last_payment_date, status: 'Paid' }
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Adds the most recent payment received from this client (date + amount,
// shown as "Last Payment" on the client's detail view).
const LAST_PAYMENT_JOIN = `
  LEFT JOIN LATERAL (
    SELECT amount, payment_date FROM payments
    WHERE client_id = c.id
    ORDER BY payment_date DESC, created_at DESC
    LIMIT 1
  ) lp ON TRUE
`;

/** GET /api/clients/metrics -- the summary cards above the client list */
async function metrics(req, res) {
  const result = await query(
    `SELECT
        (SELECT COUNT(*) FROM clients WHERE user_id = $1) AS total_clients,
        (SELECT COUNT(*) FROM projects WHERE user_id = $1) AS total_projects,
        (SELECT COUNT(*) FROM projects WHERE user_id = $1 AND status = 'ongoing') AS ongoing_projects,
        (SELECT COUNT(*) FROM projects WHERE user_id = $1 AND status = 'completed') AS completed_projects`,
    [req.user.id]
  );
  const row = result.rows[0];
  res.json({
    totalClients: Number(row.total_clients),
    totalProjects: Number(row.total_projects),
    ongoingProjects: Number(row.ongoing_projects),
    completedProjects: Number(row.completed_projects),
  });
}

/** GET /api/clients -- searchable list */
async function list(req, res) {
  const { search } = req.query;
  const conditions = ['user_id = $1'];
  const params = [req.user.id];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length} OR phone ILIKE $${params.length})`);
  }

  const result = await query(
    `SELECT c.*, lp.amount AS last_payment_amount, lp.payment_date AS last_payment_date,
        (SELECT COUNT(*) FROM projects p WHERE p.client_id = c.id) AS project_count
     FROM clients c
     ${LAST_PAYMENT_JOIN}
     WHERE ${conditions.join(' AND ')} ORDER BY c.created_at DESC`,
    params
  );
  res.json({
    clients: result.rows.map((row) => ({ ...toClientDto(row), projectCount: Number(row.project_count) })),
  });
}

/** GET /api/clients/:id */
async function getOne(req, res) {
  const result = await query(
    `SELECT c.*, lp.amount AS last_payment_amount, lp.payment_date AS last_payment_date
     FROM clients c
     ${LAST_PAYMENT_JOIN}
     WHERE c.id = $1 AND c.user_id = $2`,
    [req.params.id, req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found.' });
  res.json({ client: toClientDto(result.rows[0]) });
}

/** POST /api/clients -- "Add Client" button */
async function create(req, res) {
  const parsed = clientSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const d = parsed.data;

  const result = await query(
    `INSERT INTO clients (user_id, name, phone, email, invoice_currency, country)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user.id, d.name, d.phone || null, d.email || null, d.invoiceCurrency || 'USD', d.country || null]
  );
  res.status(201).json({ client: toClientDto(result.rows[0]) });
}

/** PUT /api/clients/:id */
async function update(req, res) {
  const parsed = clientSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const d = parsed.data;

  const result = await query(
    `UPDATE clients SET
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        email = COALESCE($3, email),
        invoice_currency = COALESCE($4, invoice_currency),
        country = COALESCE($5, country)
     WHERE id = $6 AND user_id = $7 RETURNING *`,
    [d.name, d.phone, d.email, d.invoiceCurrency, d.country, req.params.id, req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found.' });
  res.json({ client: toClientDto(result.rows[0]) });
}

/** DELETE /api/clients/:id */
async function remove(req, res) {
  const result = await query('DELETE FROM clients WHERE id = $1 AND user_id = $2 RETURNING id', [
    req.params.id,
    req.user.id,
  ]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found.' });
  res.status(204).send();
}

module.exports = { metrics, list, getOne, create, update, remove };
