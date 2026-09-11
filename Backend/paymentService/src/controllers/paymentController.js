/**
 * paymentController.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Payments are entered manually -- there is NO integration with any
 *   payment gateway (Stripe, Razorpay, etc.). Every time a freelancer
 *   receives money from a client, they add a row here themselves.
 *
 *   A single payment can now cover MULTIPLE projects for the same
 *   client (e.g. one bank transfer that pays for two ongoing projects
 *   at once) -- see the `payment_projects` junction table. `projectId`
 *   (singular) is still accepted/returned as the first/primary project
 *   for backwards compatibility, but `projectIds` (plural) is the
 *   authoritative field going forward.
 *
 *   `summary` powers both the Payments dashboard card (no project
 *   filter = every project) AND the per-project filter view: pass
 *   `projectIds` to scope Total Amount / Paid / Balance to just those
 *   projects' combined budget and the payments that touch them.
 */

const { z } = require('zod');
const { query } = require('../config/db');

const paymentSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  amount: z.number().nonnegative('Amount must be zero or greater'),
  paymentDate: z.string().optional(), // YYYY-MM-DD
  // `projectIds`: the authoritative multi-project association. Kept
  // optional + defaulting to [] so a payment can also be logged with no
  // project attached at all (e.g. a general retainer payment).
  projectIds: z.array(z.string().uuid()).optional().default([]),
  clientId: z.string().uuid().optional().nullable(),
});

function toPaymentDto(row) {
  return {
    id: row.id,
    title: row.title,
    amount: Number(row.amount),
    paymentDate: row.payment_date,
    // `projects` is the full list this payment covers; `projectId`/
    // `projectName` (singular) mirror the first one for older UI code.
    projects: row.project_names
      ? row.project_ids.map((id, i) => ({ id, name: row.project_names[i] }))
      : [],
    projectId: row.project_ids?.[0] || null,
    projectName: row.project_names?.[0] || null,
    clientId: row.client_id,
    clientName: row.client_name || null,
    createdAt: row.created_at,
  };
}

// Aggregates each payment's associated projects into arrays via
// array_agg, so one row per payment comes back even when it spans
// several projects (instead of one row per payment-project pair).
const BASE_SELECT = `
  SELECT
    pay.*,
    cl.name AS client_name,
    COALESCE(array_agg(pp.project_id) FILTER (WHERE pp.project_id IS NOT NULL), '{}') AS project_ids,
    COALESCE(array_agg(proj.name) FILTER (WHERE proj.name IS NOT NULL), '{}') AS project_names
  FROM payments pay
  LEFT JOIN clients cl ON cl.id = pay.client_id
  LEFT JOIN payment_projects pp ON pp.payment_id = pay.id
  LEFT JOIN projects proj ON proj.id = pp.project_id
`;
const GROUP_BY = 'GROUP BY pay.id, cl.name';

// Writes the payment_projects rows for a payment, replacing whatever
// was there before (used by both create and update).
async function syncPaymentProjects(paymentId, projectIds) {
  await query('DELETE FROM payment_projects WHERE payment_id = $1', [paymentId]);
  for (const projectId of projectIds) {
    await query(
      'INSERT INTO payment_projects (payment_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [paymentId, projectId]
    );
  }
  // Keep the legacy single-project column pointed at the first
  // selected project, so any code still reading `project_id` directly
  // continues to see a sensible value.
  await query('UPDATE payments SET project_id = $1 WHERE id = $2', [projectIds[0] || null, paymentId]);
}

/**
 * GET /api/payments/summary?from=&to=&projectIds=id1,id2
 * Total Amount = sum of budgets of the selected projects (or every
 * project if none selected); Total Paid = sum of DISTINCT payments that
 * touch any of those projects, in the date range; Total Balance = the
 * difference.
 */
async function summary(req, res) {
  const { from, to, projectIds } = req.query;
  const selectedProjectIds = projectIds ? String(projectIds).split(',').filter(Boolean) : [];

  // ---- Total Amount: sum of budgets for the relevant projects ----------
  const budgetParams = [req.user.id];
  let budgetWhere = 'user_id = $1';
  if (selectedProjectIds.length > 0) {
    budgetParams.push(selectedProjectIds);
    budgetWhere += ` AND id = ANY($${budgetParams.length})`;
  }
  const budgetResult = await query(
    `SELECT COALESCE(SUM(budget), 0) AS total_amount FROM projects WHERE ${budgetWhere}`,
    budgetParams
  );

  // ---- Total Paid: sum of payments that touch any selected project -----
  // (or every payment, if no project filter is applied), in the date range.
  const paidParams = [req.user.id];
  const paidConditions = ['pay.user_id = $1'];
  if (from) {
    paidParams.push(from);
    paidConditions.push(`pay.payment_date >= $${paidParams.length}`);
  }
  if (to) {
    paidParams.push(to);
    paidConditions.push(`pay.payment_date <= $${paidParams.length}`);
  }
  let paidQuery;
  if (selectedProjectIds.length > 0) {
    paidParams.push(selectedProjectIds);
    paidQuery = `
      SELECT COALESCE(SUM(DISTINCT_AMOUNTS.amount), 0) AS total_paid FROM (
        SELECT DISTINCT pay.id, pay.amount
        FROM payments pay
        JOIN payment_projects pp ON pp.payment_id = pay.id
        WHERE ${paidConditions.join(' AND ')} AND pp.project_id = ANY($${paidParams.length})
      ) AS DISTINCT_AMOUNTS`;
  } else {
    paidQuery = `SELECT COALESCE(SUM(pay.amount), 0) AS total_paid FROM payments pay WHERE ${paidConditions.join(' AND ')}`;
  }
  const paidResult = await query(paidQuery, paidParams);

  const totalAmount = Number(budgetResult.rows[0].total_amount);
  const totalPaid = Number(paidResult.rows[0].total_paid);

  res.json({
    totalAmount,
    totalPaid,
    totalBalance: Math.max(totalAmount - totalPaid, 0),
  });
}

/** GET /api/payments -- filterable list (date range, project(s), client) */
async function list(req, res) {
  const { from, to, projectIds, clientId, search } = req.query;
  const selectedProjectIds = projectIds ? String(projectIds).split(',').filter(Boolean) : [];

  const conditions = ['pay.user_id = $1'];
  const params = [req.user.id];

  if (from) {
    params.push(from);
    conditions.push(`pay.payment_date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`pay.payment_date <= $${params.length}`);
  }
  if (clientId) {
    params.push(clientId);
    conditions.push(`pay.client_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`pay.title ILIKE $${params.length}`);
  }
  if (selectedProjectIds.length > 0) {
    params.push(selectedProjectIds);
    // A payment matches if ANY of its associated projects is in the filter.
    conditions.push(
      `pay.id IN (SELECT payment_id FROM payment_projects WHERE project_id = ANY($${params.length}))`
    );
  }

  const result = await query(
    `${BASE_SELECT} WHERE ${conditions.join(' AND ')} ${GROUP_BY} ORDER BY pay.payment_date DESC, pay.created_at DESC`,
    params
  );
  res.json({ payments: result.rows.map(toPaymentDto) });
}

/** POST /api/payments -- "Add Payment" button, supports selecting several projects */
async function create(req, res) {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const d = parsed.data;

  const result = await query(
    `INSERT INTO payments (user_id, project_id, client_id, title, amount, payment_date)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6, CURRENT_DATE)) RETURNING id`,
    [req.user.id, d.projectIds[0] || null, d.clientId || null, d.title, d.amount, d.paymentDate || null]
  );
  await syncPaymentProjects(result.rows[0].id, d.projectIds);

  const full = await query(`${BASE_SELECT} WHERE pay.id = $1 ${GROUP_BY}`, [result.rows[0].id]);
  res.status(201).json({ payment: toPaymentDto(full.rows[0]) });
}

/** PUT /api/payments/:id */
async function update(req, res) {
  const parsed = paymentSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const d = parsed.data;

  const existing = await query('SELECT id FROM payments WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.user.id,
  ]);
  if (existing.rows.length === 0) return res.status(404).json({ error: 'Payment not found.' });

  await query(
    `UPDATE payments SET
        title = COALESCE($1, title),
        amount = COALESCE($2, amount),
        payment_date = COALESCE($3, payment_date),
        client_id = COALESCE($4, client_id)
     WHERE id = $5`,
    [d.title, d.amount, d.paymentDate, d.clientId, req.params.id]
  );
  if (d.projectIds) await syncPaymentProjects(req.params.id, d.projectIds);

  const full = await query(`${BASE_SELECT} WHERE pay.id = $1 ${GROUP_BY}`, [req.params.id]);
  res.json({ payment: toPaymentDto(full.rows[0]) });
}

/** DELETE /api/payments/:id */
async function remove(req, res) {
  const result = await query('DELETE FROM payments WHERE id = $1 AND user_id = $2 RETURNING id', [
    req.params.id,
    req.user.id,
  ]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Payment not found.' });
  res.status(204).send();
}

module.exports = { summary, list, create, update, remove };
