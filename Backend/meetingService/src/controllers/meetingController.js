/**
 * meetingController.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Powers the Google-Calendar-like Meetings section. `listByRange`
 *   accepts a `from`/`to` date pair -- the frontend calculates that
 *   range depending on whether the user is viewing Day / Week / Month,
 *   so this endpoint stays simple and range-agnostic; all the
 *   "which days are in this week" logic lives in the UI.
 *
 *   The `remind_before_minutes` + `reminder_sent` columns are read by
 *   notificationService's background scanner, which flips
 *   `reminder_sent` to true once it has created a bell notification for
 *   that meeting (see notificationService/src/jobs/reminderScanner.js).
 */

const { z } = require('zod');
const { query } = require('../config/db');

const MEETING_STATUSES = ['scheduled', 'completed', 'cancelled'];

const meetingSchema = z.object({
  title: z.string().trim().min(1, 'Meeting title is required').max(200),
  description: z.string().max(5000).optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  meetingDate: z.string().min(1, 'Date is required'), // YYYY-MM-DD
  meetingTime: z.string().min(1, 'Time is required'), // HH:MM
  durationMinutes: z.number().int().positive().optional(),
  googleMeetLink: z.string().url().optional().nullable().or(z.literal('')),
  remindBeforeMinutes: z.number().int().nonnegative().optional(),
  status: z.enum(MEETING_STATUSES).optional(),
});

function toMeetingDto(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    clientId: row.client_id,
    clientName: row.client_name || null,
    projectId: row.project_id,
    projectName: row.project_name || null,
    leadId: row.lead_id,
    leadName: row.lead_name || null,
    meetingDate: row.meeting_date,
    meetingTime: row.meeting_time,
    durationMinutes: row.duration_minutes,
    googleMeetLink: row.google_meet_link,
    remindBeforeMinutes: row.remind_before_minutes,
    status: row.status,
    createdAt: row.created_at,
  };
}

const BASE_SELECT = `
  SELECT m.*, c.name AS client_name, p.name AS project_name, l.name AS lead_name
  FROM meetings m
  LEFT JOIN clients c ON c.id = m.client_id
  LEFT JOIN projects p ON p.id = m.project_id
  LEFT JOIN leads l ON l.id = m.lead_id
`;

// A meeting whose date+time is in the past but is still marked
// 'scheduled' is treated as completed on the fly (in addition to the
// background flip done by a periodic job) so History/counts are always
// accurate even the instant a meeting's time passes.
async function autoCompletePastMeetings(userId) {
  await query(
    `UPDATE meetings SET status = 'completed'
     WHERE user_id = $1 AND status = 'scheduled' AND (meeting_date + meeting_time) < NOW()`,
    [userId]
  );
}

/** GET /api/meetings?from=YYYY-MM-DD&to=YYYY-MM-DD -- calendar view */
async function listByRange(req, res) {
  await autoCompletePastMeetings(req.user.id);
  const { from, to } = req.query;
  const conditions = ['m.user_id = $1'];
  const params = [req.user.id];

  if (from) {
    params.push(from);
    conditions.push(`m.meeting_date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`m.meeting_date <= $${params.length}`);
  }

  const result = await query(
    `${BASE_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY m.meeting_date ASC, m.meeting_time ASC`,
    params
  );
  res.json({ meetings: result.rows.map(toMeetingDto) });
}

/**
 * GET /api/meetings/history?search=&from=&to=&entityType=lead|project|client&entityId=
 * Powers the "Meeting History" section: every COMPLETED meeting, with
 * the same search-bar + date-filter + lead/project/client filter shape
 * used on the Leads board (see SearchFilterBar on the frontend).
 */
async function history(req, res) {
  await autoCompletePastMeetings(req.user.id);
  const { search, from, to, entityType, entityId } = req.query;

  const conditions = [`m.user_id = $1`, `m.status = 'completed'`];
  const params = [req.user.id];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`m.title ILIKE $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`m.meeting_date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`m.meeting_date <= $${params.length}`);
  }
  if (entityType === 'lead' && entityId) {
    params.push(entityId);
    conditions.push(`m.lead_id = $${params.length}`);
  } else if (entityType === 'project' && entityId) {
    params.push(entityId);
    conditions.push(`m.project_id = $${params.length}`);
  } else if (entityType === 'client' && entityId) {
    params.push(entityId);
    conditions.push(`m.client_id = $${params.length}`);
  }

  const result = await query(
    `${BASE_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY m.meeting_date DESC, m.meeting_time DESC`,
    params
  );
  res.json({ meetings: result.rows.map(toMeetingDto) });
}

/** GET /api/meetings/:id */
async function getOne(req, res) {
  const result = await query(`${BASE_SELECT} WHERE m.id = $1 AND m.user_id = $2`, [
    req.params.id,
    req.user.id,
  ]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Meeting not found.' });
  res.json({ meeting: toMeetingDto(result.rows[0]) });
}

/** POST /api/meetings -- "Schedule a Meeting" button */
async function create(req, res) {
  const parsed = meetingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const d = parsed.data;

  const result = await query(
    `INSERT INTO meetings
       (user_id, client_id, project_id, lead_id, title, description, meeting_date, meeting_time,
        duration_minutes, google_meet_link, remind_before_minutes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [
      req.user.id,
      d.clientId || null,
      d.projectId || null,
      d.leadId || null,
      d.title,
      d.description || null,
      d.meetingDate,
      d.meetingTime,
      d.durationMinutes ?? 30,
      d.googleMeetLink || null,
      d.remindBeforeMinutes ?? 10,
    ]
  );
  const full = await query(`${BASE_SELECT} WHERE m.id = $1`, [result.rows[0].id]);
  res.status(201).json({ meeting: toMeetingDto(full.rows[0]) });
}

/** PUT /api/meetings/:id */
async function update(req, res) {
  const parsed = meetingSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const d = parsed.data;

  const result = await query(
    `UPDATE meetings SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        client_id = COALESCE($3, client_id),
        project_id = COALESCE($4, project_id),
        lead_id = COALESCE($5, lead_id),
        meeting_date = COALESCE($6, meeting_date),
        meeting_time = COALESCE($7, meeting_time),
        duration_minutes = COALESCE($8, duration_minutes),
        google_meet_link = COALESCE($9, google_meet_link),
        remind_before_minutes = COALESCE($10, remind_before_minutes),
        status = COALESCE($11, status),
        -- if the date/time or reminder window changes, allow the
        -- reminder to be re-sent for the new schedule
        reminder_sent = CASE WHEN $6 IS NOT NULL OR $7 IS NOT NULL OR $10 IS NOT NULL THEN FALSE ELSE reminder_sent END
     WHERE id = $12 AND user_id = $13 RETURNING id`,
    [
      d.title, d.description, d.clientId, d.projectId, d.leadId, d.meetingDate, d.meetingTime,
      d.durationMinutes, d.googleMeetLink, d.remindBeforeMinutes, d.status, req.params.id, req.user.id,
    ]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Meeting not found.' });

  const full = await query(`${BASE_SELECT} WHERE m.id = $1`, [req.params.id]);
  res.json({ meeting: toMeetingDto(full.rows[0]) });
}

/** DELETE /api/meetings/:id */
async function remove(req, res) {
  const result = await query('DELETE FROM meetings WHERE id = $1 AND user_id = $2 RETURNING id', [
    req.params.id,
    req.user.id,
  ]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Meeting not found.' });
  res.status(204).send();
}

module.exports = { listByRange, history, getOne, create, update, remove, MEETING_STATUSES };
