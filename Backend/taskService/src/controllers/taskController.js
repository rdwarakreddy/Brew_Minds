/**
 * taskController.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   CRUD + Kanban board for tasks, with the "show this card in red"
 *   business rule computed ONCE, server-side, so the frontend never has
 *   to re-implement date-comparison logic (and risk getting timezones
 *   wrong). The rule, exactly as specified in the brief:
 *
 *     - A task still in `todo` whose start_date has already passed
 *       (it should have been started by now) -> overdue.
 *     - A task that is NOT `completed` whose end_date has already
 *       passed (it should have been finished by now) -> overdue.
 *     - A `completed` task is never shown as overdue, no matter what
 *       its dates are.
 *
 *   We compare against CURRENT_DATE (server's date) directly in SQL.
 */

const { z } = require('zod');
const { query } = require('../config/db');

const TASK_STATUSES = ['todo', 'in_progress', 'completed'];

const taskSchema = z
  .object({
    name: z.string().trim().min(1, 'Task name is required').max(200),
    projectId: z.string().uuid().optional().nullable(),
    clientId: z.string().uuid().optional().nullable(),
    status: z.enum(TASK_STATUSES).optional(),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: 'End date cannot be before start date',
    path: ['endDate'],
  });

const moveTaskSchema = z.object({
  status: z.enum(TASK_STATUSES),
  boardPosition: z.number().int().nonnegative(),
});

function toTaskDto(row) {
  return {
    id: row.id,
    name: row.name,
    projectId: row.project_id,
    projectName: row.project_name || null,
    clientId: row.client_id,
    clientName: row.client_name || null,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    boardPosition: row.board_position,
    // computed by Postgres in the SELECT below -- true means "render this card in red"
    isOverdue: row.is_overdue,
    createdAt: row.created_at,
  };
}

const BASE_SELECT = `
  SELECT t.*, p.name AS project_name, c.name AS client_name,
    (
      (t.status = 'todo' AND t.start_date < CURRENT_DATE)
      OR (t.status <> 'completed' AND t.end_date < CURRENT_DATE)
    ) AS is_overdue
  FROM tasks t
  LEFT JOIN projects p ON p.id = t.project_id
  LEFT JOIN clients c ON c.id = t.client_id
`;

/** GET /api/tasks/board */
async function listByBoard(req, res) {
  const result = await query(
    `${BASE_SELECT} WHERE t.user_id = $1 ORDER BY t.status, t.board_position ASC`,
    [req.user.id]
  );
  const board = Object.fromEntries(TASK_STATUSES.map((s) => [s, []]));
  result.rows.forEach((row) => board[row.status].push(toTaskDto(row)));
  res.json({ board });
}

/** GET /api/tasks -- searchable/filterable flat list */
async function list(req, res) {
  const { search, status, projectId, overdueOnly } = req.query;
  const conditions = ['t.user_id = $1'];
  const params = [req.user.id];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`t.name ILIKE $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (projectId) {
    params.push(projectId);
    conditions.push(`t.project_id = $${params.length}`);
  }

  let sql = `${BASE_SELECT} WHERE ${conditions.join(' AND ')}`;
  if (overdueOnly === 'true') {
    sql = `SELECT * FROM (${sql}) sub WHERE sub.is_overdue = TRUE`;
  }
  sql += ` ORDER BY t.end_date ASC`;

  const result = await query(sql, params);
  res.json({ tasks: result.rows.map(toTaskDto) });
}

/** GET /api/tasks/today -- powers the Dashboard's "Today's Tasks" section */
async function listToday(req, res) {
  const result = await query(
    `${BASE_SELECT} WHERE t.user_id = $1 AND CURRENT_DATE BETWEEN t.start_date AND t.end_date
     ORDER BY t.status`,
    [req.user.id]
  );
  res.json({ tasks: result.rows.map(toTaskDto) });
}

/** POST /api/tasks -- "Add Task" button */
async function create(req, res) {
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const d = parsed.data;

  const posResult = await query(
    `SELECT COALESCE(MAX(board_position), -1) + 1 AS next_pos FROM tasks WHERE user_id = $1 AND status = $2`,
    [req.user.id, d.status || 'todo']
  );

  const result = await query(
    `INSERT INTO tasks (user_id, project_id, client_id, name, status, start_date, end_date, board_position)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [
      req.user.id,
      d.projectId || null,
      d.clientId || null,
      d.name,
      d.status || 'todo',
      d.startDate,
      d.endDate,
      posResult.rows[0].next_pos,
    ]
  );
  const full = await query(`${BASE_SELECT} WHERE t.id = $1`, [result.rows[0].id]);
  res.status(201).json({ task: toTaskDto(full.rows[0]) });
}

/** PUT /api/tasks/:id */
async function update(req, res) {
  const parsed = taskSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const d = parsed.data;

  const result = await query(
    `UPDATE tasks SET
        name = COALESCE($1, name),
        project_id = COALESCE($2, project_id),
        client_id = COALESCE($3, client_id),
        status = COALESCE($4, status),
        start_date = COALESCE($5, start_date),
        end_date = COALESCE($6, end_date)
     WHERE id = $7 AND user_id = $8 RETURNING id`,
    [d.name, d.projectId, d.clientId, d.status, d.startDate, d.endDate, req.params.id, req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found.' });

  const full = await query(`${BASE_SELECT} WHERE t.id = $1`, [req.params.id]);
  res.json({ task: toTaskDto(full.rows[0]) });
}

/** PATCH /api/tasks/:id/move -- drag-and-drop */
async function move(req, res) {
  const parsed = moveTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const { status, boardPosition } = parsed.data;

  const result = await query(
    `UPDATE tasks SET status = $1, board_position = $2 WHERE id = $3 AND user_id = $4 RETURNING id`,
    [status, boardPosition, req.params.id, req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found.' });

  const full = await query(`${BASE_SELECT} WHERE t.id = $1`, [req.params.id]);
  res.json({ task: toTaskDto(full.rows[0]) });
}

/** DELETE /api/tasks/:id */
async function remove(req, res) {
  const result = await query('DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id', [
    req.params.id,
    req.user.id,
  ]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found.' });
  res.status(204).send();
}

module.exports = { listByBoard, list, listToday, create, update, move, remove };
