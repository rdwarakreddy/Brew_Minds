/**
 * notificationController.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Powers the bell icon at the top of the sidebar: unread count badge,
 *   the dropdown list, and marking notifications as read.
 */

const { query } = require('../config/db');

function toNotificationDto(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    referenceTable: row.reference_table,
    referenceId: row.reference_id,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

/** GET /api/notifications -- most recent first, for the bell dropdown */
async function list(req, res) {
  const result = await query(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.user.id]
  );
  res.json({ notifications: result.rows.map(toNotificationDto) });
}

/** GET /api/notifications/unread-count -- small badge number on the bell */
async function unreadCount(req, res) {
  const result = await query(
    `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
    [req.user.id]
  );
  res.json({ count: Number(result.rows[0].count) });
}

/** PATCH /api/notifications/:id/read */
async function markRead(req, res) {
  const result = await query(
    `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id`,
    [req.params.id, req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Notification not found.' });
  res.status(204).send();
}

/** PATCH /api/notifications/read-all */
async function markAllRead(req, res) {
  await query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`, [
    req.user.id,
  ]);
  res.status(204).send();
}

module.exports = { list, unreadCount, markRead, markAllRead };
