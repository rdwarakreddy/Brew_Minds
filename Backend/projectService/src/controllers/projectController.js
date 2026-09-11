/**
 * projectController.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   CRUD for projects, a Kanban board view, drag-and-drop move, and
 *   search/filters -- the same shape as leadController but for the
 *   `project_status` enum (new, ongoing, on_hold, completed, cancelled).
 *
 *   Every project response includes `paidAmount` / `dueAmount`,
 *   calculated LIVE from the payments table (SUM of payments for that
 *   project) rather than stored redundantly -- see the comment on the
 *   `payments` table in Database/init/002_schema.sql for why.
 */

const { z } = require('zod');
const { query } = require('../config/db');

const PROJECT_STATUSES = ['new', 'ongoing', 'on_hold', 'completed', 'cancelled'];

const projectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(200),
  description: z.string().max(5000).optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  status: z.enum(PROJECT_STATUSES).optional(),
  currency: z.string().trim().max(10).optional(),
  budget: z.number().nonnegative().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

const moveProjectSchema = z.object({
  status: z.enum(PROJECT_STATUSES),
  boardPosition: z.number().int().nonnegative(),
});

function toProjectDto(row) {
  const budget = Number(row.budget);
  const paid = Number(row.paid_amount || 0);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    clientId: row.client_id,
    clientName: row.client_name || null,
    status: row.status,
    currency: row.currency,
    budget,
    paidAmount: paid,
    dueAmount: Math.max(budget - paid, 0),
    startDate: row.start_date,
    endDate: row.end_date,
    boardPosition: row.board_position,
    meetingsCount: row.meetings_count !== undefined ? Number(row.meetings_count) : undefined,
    lastPayment:
      row.last_payment_amount !== undefined && row.last_payment_amount !== null
        ? { amount: Number(row.last_payment_amount), date: row.last_payment_date, status: 'Paid' }
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Reused SELECT: joins client name, the live SUM of payments, the most
// recent single payment (date/amount, shown as "Last Payment" on the
// project's detail view), and a live COUNT of meetings held for this
// project, so every endpoint below returns consistent, complete data.
const BASE_SELECT = `
  SELECT p.*, c.name AS client_name,
         COALESCE((SELECT SUM(amount) FROM payments WHERE project_id = p.id), 0) AS paid_amount,
         lp.amount AS last_payment_amount,
         lp.payment_date AS last_payment_date,
         (SELECT COUNT(*) FROM meetings m WHERE m.project_id = p.id) AS meetings_count
  FROM projects p
  LEFT JOIN clients c ON c.id = p.client_id
  LEFT JOIN LATERAL (
    SELECT amount, payment_date FROM payments
    WHERE project_id = p.id
    ORDER BY payment_date DESC, created_at DESC
    LIMIT 1
  ) lp ON TRUE
`;

/** GET /api/projects/board */
async function listByBoard(req, res) {
  const result = await query(
    `${BASE_SELECT} WHERE p.user_id = $1 ORDER BY p.status, p.board_position ASC`,
    [req.user.id]
  );
  const board = Object.fromEntries(PROJECT_STATUSES.map((s) => [s, []]));
  result.rows.forEach((row) => board[row.status].push(toProjectDto(row)));
  res.json({ board });
}

/** GET /api/projects -- searchable/filterable flat list */
async function list(req, res) {
  const { search, status, clientId } = req.query;
  const conditions = ['p.user_id = $1'];
  const params = [req.user.id];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(p.name ILIKE $${params.length} OR c.name ILIKE $${params.length})`);
  }
  if (status) {
    params.push(status);
    conditions.push(`p.status = $${params.length}`);
  }
  if (clientId) {
    params.push(clientId);
    conditions.push(`p.client_id = $${params.length}`);
  }

  const result = await query(
    `${BASE_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY p.created_at DESC`,
    params
  );
  res.json({ projects: result.rows.map(toProjectDto) });
}

/** GET /api/projects/:id */
async function getOne(req, res) {
  const result = await query(`${BASE_SELECT} WHERE p.id = $1 AND p.user_id = $2`, [
    req.params.id,
    req.user.id,
  ]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found.' });
  res.json({ project: toProjectDto(result.rows[0]) });
}

/** GET /api/projects/lookup -- lightweight {id,name} list for dropdowns in other sections */
async function lookup(req, res) {
  const result = await query(
    `SELECT id, name, client_id FROM projects WHERE user_id = $1 ORDER BY name ASC`,
    [req.user.id]
  );
  res.json({ projects: result.rows });
}

/** POST /api/projects -- "Add Project" button */
async function create(req, res) {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const d = parsed.data;

  const posResult = await query(
    `SELECT COALESCE(MAX(board_position), -1) + 1 AS next_pos FROM projects WHERE user_id = $1 AND status = $2`,
    [req.user.id, d.status || 'new']
  );

  const result = await query(
    `INSERT INTO projects (user_id, client_id, name, description, status, currency, budget, start_date, end_date, board_position)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      req.user.id,
      d.clientId || null,
      d.name,
      d.description || null,
      d.status || 'new',
      d.currency || 'USD',
      d.budget ?? 0,
      d.startDate || null,
      d.endDate || null,
      posResult.rows[0].next_pos,
    ]
  );
  res.status(201).json({ project: toProjectDto({ ...result.rows[0], paid_amount: 0 }) });
}

/** PUT /api/projects/:id */
async function update(req, res) {
  const parsed = projectSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const d = parsed.data;

  const result = await query(
    `UPDATE projects SET
        client_id = COALESCE($1, client_id),
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        status = COALESCE($4, status),
        currency = COALESCE($5, currency),
        budget = COALESCE($6, budget),
        start_date = COALESCE($7, start_date),
        end_date = COALESCE($8, end_date)
     WHERE id = $9 AND user_id = $10 RETURNING id`,
    [
      d.clientId, d.name, d.description, d.status, d.currency, d.budget, d.startDate, d.endDate,
      req.params.id, req.user.id,
    ]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found.' });

  const full = await query(`${BASE_SELECT} WHERE p.id = $1`, [req.params.id]);
  res.json({ project: toProjectDto(full.rows[0]) });
}

/** PATCH /api/projects/:id/move -- drag-and-drop */
async function move(req, res) {
  const parsed = moveProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const { status, boardPosition } = parsed.data;

  const result = await query(
    `UPDATE projects SET status = $1, board_position = $2 WHERE id = $3 AND user_id = $4 RETURNING id`,
    [status, boardPosition, req.params.id, req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found.' });

  const full = await query(`${BASE_SELECT} WHERE p.id = $1`, [req.params.id]);
  res.json({ project: toProjectDto(full.rows[0]) });
}

/** DELETE /api/projects/:id */
async function remove(req, res) {
  const result = await query('DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id', [
    req.params.id,
    req.user.id,
  ]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found.' });
  res.status(204).send();
}

module.exports = { listByBoard, list, getOne, lookup, create, update, move, remove, PROJECT_STATUSES };
