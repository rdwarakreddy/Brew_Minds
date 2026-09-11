/**
 * leadController.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   CRUD for leads, plus:
 *     - listByBoard: returns leads GROUPED BY status, ready for the
 *       Kanban board to render as columns in one request.
 *     - move: called when a card is dragged to a new column/position.
 *     - search + filters: name/email/phone text search combined with
 *       status/source/country filters and pagination.
 *
 *   EVERY query below filters `WHERE user_id = $1` using the logged-in
 *   user's id from the verified JWT (req.user.id) -- this is what keeps
 *   one freelancer's leads completely invisible to another freelancer,
 *   even though they all share the same database/table.
 */

const { query } = require('../config/db');
const { leadSchema, moveLeadSchema, LEAD_STATUSES } = require('../utils/validation');

function toLeadDto(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    country: row.country,
    estimatedBudget: row.estimated_budget !== null ? Number(row.estimated_budget) : null,
    status: row.status,
    currency: row.currency,
    source: row.source,
    nextFollowupAt: row.next_followup_at,
    notes: row.notes,
    boardPosition: row.board_position,
    meetingsCount: row.meetings_count !== undefined ? Number(row.meetings_count) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Adds a live COUNT of meetings linked to each lead -- powers the
// "No. of meetings" shown on the Lead card/detail (see meetingService,
// which sets meetings.lead_id when a meeting is scheduled against a lead).
const SELECT_WITH_MEETING_COUNT = `
  SELECT l.*,
         (SELECT COUNT(*) FROM meetings m WHERE m.lead_id = l.id) AS meetings_count
  FROM leads l
`;

/**
 * GET /api/leads/board
 * Returns { new: [...], contacted: [...], ... } so the frontend can
 * render six Kanban columns from a single request.
 */
async function listByBoard(req, res) {
  const result = await query(
    `${SELECT_WITH_MEETING_COUNT} WHERE l.user_id = $1 ORDER BY l.status, l.board_position ASC`,
    [req.user.id]
  );

  const board = Object.fromEntries(LEAD_STATUSES.map((s) => [s, []]));
  result.rows.forEach((row) => board[row.status].push(toLeadDto(row)));
  res.json({ board });
}

/**
 * GET /api/leads
 * Flat, filterable, searchable, paginated list (used by search bar +
 * filters above the board, and for reporting elsewhere in the app).
 */
async function list(req, res) {
  const { search, status, source, country, page = 1, pageSize = 50 } = req.query;

  const conditions = ['user_id = $1'];
  const params = [req.user.id];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(name ILIKE $${params.length} OR email ILIKE $${params.length} OR phone ILIKE $${params.length})`
    );
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (source) {
    params.push(source);
    conditions.push(`source = $${params.length}`);
  }
  if (country) {
    params.push(country);
    conditions.push(`country = $${params.length}`);
  }

  const limit = Math.min(Number(pageSize) || 50, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const whereClause = conditions.join(' AND ');
  const dataResult = await query(
    `${SELECT_WITH_MEETING_COUNT} WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  const countResult = await query(`SELECT COUNT(*) FROM leads WHERE ${whereClause}`, params);

  res.json({
    leads: dataResult.rows.map(toLeadDto),
    total: Number(countResult.rows[0].count),
    page: Number(page),
    pageSize: limit,
  });
}

/** GET /api/leads/lookup -- lightweight {id,name} list for dropdowns in other sections */
async function lookup(req, res) {
  const result = await query(`SELECT id, name FROM leads WHERE user_id = $1 ORDER BY name ASC`, [req.user.id]);
  res.json({ leads: result.rows });
}

/** GET /api/leads/:id -- includes this lead's meeting history */
async function getOne(req, res) {
  const result = await query(`${SELECT_WITH_MEETING_COUNT} WHERE l.id = $1 AND l.user_id = $2`, [
    req.params.id,
    req.user.id,
  ]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Lead not found.' });

  const meetingsResult = await query(
    `SELECT id, title, meeting_date, meeting_time, duration_minutes, status
     FROM meetings WHERE lead_id = $1 ORDER BY meeting_date DESC, meeting_time DESC`,
    [req.params.id]
  );

  res.json({
    lead: {
      ...toLeadDto(result.rows[0]),
      meetings: meetingsResult.rows.map((m) => ({
        id: m.id,
        title: m.title,
        meetingDate: m.meeting_date,
        meetingTime: m.meeting_time,
        durationMinutes: m.duration_minutes,
        status: m.status,
      })),
    },
  });
}

/** POST /api/leads -- "Add Lead" button */
async function create(req, res) {
  const parsed = leadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const d = parsed.data;

  // New cards are placed at the end of their column.
  const posResult = await query(
    `SELECT COALESCE(MAX(board_position), -1) + 1 AS next_pos FROM leads WHERE user_id = $1 AND status = $2`,
    [req.user.id, d.status || 'new']
  );

  const result = await query(
    `INSERT INTO leads
       (user_id, name, phone, email, country, estimated_budget, status, currency, source, next_followup_at, notes, board_position)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      req.user.id,
      d.name,
      d.phone || null,
      d.email || null,
      d.country || null,
      d.estimatedBudget ?? null,
      d.status || 'new',
      d.currency || 'USD',
      d.source || null,
      d.nextFollowupAt || null,
      d.notes || null,
      posResult.rows[0].next_pos,
    ]
  );
  res.status(201).json({ lead: toLeadDto(result.rows[0]) });
}

/** PUT /api/leads/:id -- edit lead details */
async function update(req, res) {
  const parsed = leadSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const d = parsed.data;

  const result = await query(
    `UPDATE leads SET
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        email = COALESCE($3, email),
        country = COALESCE($4, country),
        estimated_budget = COALESCE($5, estimated_budget),
        status = COALESCE($6, status),
        currency = COALESCE($7, currency),
        source = COALESCE($8, source),
        next_followup_at = COALESCE($9, next_followup_at),
        notes = COALESCE($10, notes)
     WHERE id = $11 AND user_id = $12
     RETURNING *`,
    [
      d.name, d.phone, d.email, d.country, d.estimatedBudget, d.status, d.currency, d.source,
      d.nextFollowupAt, d.notes, req.params.id, req.user.id,
    ]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Lead not found.' });
  res.json({ lead: toLeadDto(result.rows[0]) });
}

/**
 * PATCH /api/leads/:id/move
 * Called when the user drags a card to a new column/position on the
 * Kanban board. We only touch status + board_position here (a
 * lightweight, frequent operation) rather than the full update().
 */
async function move(req, res) {
  const parsed = moveLeadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const { status, boardPosition } = parsed.data;

  const result = await query(
    `UPDATE leads SET status = $1, board_position = $2 WHERE id = $3 AND user_id = $4 RETURNING *`,
    [status, boardPosition, req.params.id, req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Lead not found.' });
  res.json({ lead: toLeadDto(result.rows[0]) });
}

/** DELETE /api/leads/:id */
async function remove(req, res) {
  const result = await query('DELETE FROM leads WHERE id = $1 AND user_id = $2 RETURNING id', [
    req.params.id,
    req.user.id,
  ]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Lead not found.' });
  res.status(204).send();
}

module.exports = { listByBoard, list, lookup, getOne, create, update, move, remove };
