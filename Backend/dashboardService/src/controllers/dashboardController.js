/**
 * dashboardController.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   The Dashboard section shows four sub-sections at once (Payments,
 *   Sales Pipeline, Today's Tasks, Upcoming Reminders). Rather than the
 *   frontend firing off four separate network requests to four
 *   different services on every page load, dashboardService exists
 *   specifically to pre-aggregate all of it into ONE response -- a
 *   common microservices pattern called a "Backend For Frontend" (BFF)
 *   / aggregator service, which keeps the Dashboard fast and simple to
 *   render.
 */

const { query } = require('../config/db');

const LEAD_STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal_sent: 'Proposal Sent',
  won: 'Won',
  lost: 'Lost',
};
const LEAD_STATUSES = Object.keys(LEAD_STATUS_LABELS);

/**
 * Builds the Sales Pipeline segment breakdown for whichever entity the
 * person has chosen to view it by (Projects, Leads, or Clients) -- see
 * the filter added above the Sales Pipeline section on the Dashboard.
 */
async function buildSalesPipeline(userId, view) {
  if (view === 'leads') {
    const result = await query(
      `SELECT status, COUNT(*) AS count FROM leads WHERE user_id = $1 GROUP BY status`,
      [userId]
    );
    const counts = Object.fromEntries(result.rows.map((row) => [row.status, Number(row.count)]));
    const segments = LEAD_STATUSES.map((status) => ({
      key: status,
      label: LEAD_STATUS_LABELS[status],
      count: counts[status] || 0,
    }));
    return { view, segments, total: segments.reduce((sum, s) => sum + s.count, 0) };
  }

  if (view === 'clients') {
    // A simple engagement funnel: clients with no projects yet, clients
    // with at least one currently-ongoing project, and clients whose
    // projects are all wrapped up (completed/cancelled, none ongoing).
    const result = await query(
      `SELECT
          COUNT(*) FILTER (WHERE proj_count = 0) AS no_projects,
          COUNT(*) FILTER (WHERE proj_count > 0 AND ongoing_count > 0) AS active,
          COUNT(*) FILTER (WHERE proj_count > 0 AND ongoing_count = 0) AS wrapped_up
       FROM (
          SELECT c.id,
                 COUNT(p.id) AS proj_count,
                 COUNT(p.id) FILTER (WHERE p.status = 'ongoing') AS ongoing_count
          FROM clients c
          LEFT JOIN projects p ON p.client_id = c.id
          WHERE c.user_id = $1
          GROUP BY c.id
       ) sub`,
      [userId]
    );
    const row = result.rows[0];
    const segments = [
      { key: 'no_projects', label: 'No Projects Yet', count: Number(row.no_projects) },
      { key: 'active', label: 'Active Engagement', count: Number(row.active) },
      { key: 'wrapped_up', label: 'Wrapped Up', count: Number(row.wrapped_up) },
    ];
    return { view, segments, total: segments.reduce((sum, s) => sum + s.count, 0) };
  }

  // Default / 'projects' view.
  const result = await query(
    `SELECT
        COUNT(*) FILTER (WHERE status = 'new') AS new_projects,
        COUNT(*) FILTER (WHERE status = 'ongoing') AS ongoing_projects,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_projects,
        COUNT(*) AS total_projects
     FROM projects WHERE user_id = $1`,
    [userId]
  );
  const row = result.rows[0];
  const segments = [
    { key: 'new', label: 'New', count: Number(row.new_projects) },
    { key: 'ongoing', label: 'Ongoing', count: Number(row.ongoing_projects) },
    { key: 'completed', label: 'Completed', count: Number(row.completed_projects) },
  ];
  return {
    view: 'projects',
    segments,
    total: Number(row.total_projects),
    // Kept alongside `segments` for backwards compatibility with any
    // existing reads of these specific field names.
    newProjects: Number(row.new_projects),
    ongoingProjects: Number(row.ongoing_projects),
    completedProjects: Number(row.completed_projects),
    totalProjects: Number(row.total_projects),
  };
}

/** GET /api/dashboard/overview?from=&to=&pipelineView=projects|leads|clients */
async function overview(req, res) {
  const { from, to, pipelineView } = req.query;
  const view = ['projects', 'leads', 'clients'].includes(pipelineView) ? pipelineView : 'projects';
  const paymentConditions = ['user_id = $1'];
  const paymentParams = [req.user.id];
  if (from) {
    paymentParams.push(from);
    paymentConditions.push(`payment_date >= $${paymentParams.length}`);
  }
  if (to) {
    paymentParams.push(to);
    paymentConditions.push(`payment_date <= $${paymentParams.length}`);
  }

  // ---- 1. Payments summary -------------------------------------------
  const paidResult = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE ${paymentConditions.join(' AND ')}`,
    paymentParams
  );
  // Total Amount = the sum of budgets across every CURRENT project for
  // this user's clients -- a cancelled project no longer represents
  // money still expected, so it's excluded from the figure.
  const budgetResult = await query(
    `SELECT COALESCE(SUM(budget), 0) AS total_amount FROM projects WHERE user_id = $1 AND status <> 'cancelled'`,
    [req.user.id]
  );
  const totalAmount = Number(budgetResult.rows[0].total_amount);
  const totalPaid = Number(paidResult.rows[0].total_paid);

  // ---- 2. Sales pipeline (Projects / Leads / Clients, per the filter) ----
  const salesPipeline = await buildSalesPipeline(req.user.id, view);

  // ---- 3. Today's tasks --------------------------------------------------
  const todaysTasksResult = await query(
    `SELECT t.*, p.name AS project_name,
        (
          (t.status = 'todo' AND t.start_date < CURRENT_DATE)
          OR (t.status <> 'completed' AND t.end_date < CURRENT_DATE)
        ) AS is_overdue
     FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.user_id = $1 AND CURRENT_DATE BETWEEN t.start_date AND t.end_date
     ORDER BY t.status ASC`,
    [req.user.id]
  );

  // ---- 4. Upcoming reminders / follow-ups (leads + meetings, next 7 days) --
  const upcomingLeadsResult = await query(
    `SELECT id, name, next_followup_at, status FROM leads
     WHERE user_id = $1 AND next_followup_at IS NOT NULL
       AND next_followup_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
       AND status NOT IN ('won', 'lost')
     ORDER BY next_followup_at ASC LIMIT 10`,
    [req.user.id]
  );
  const upcomingMeetingsResult = await query(
    `SELECT id, title, meeting_date, meeting_time FROM meetings
     WHERE user_id = $1 AND (meeting_date + meeting_time) BETWEEN NOW() AND NOW() + INTERVAL '7 days'
     ORDER BY meeting_date ASC, meeting_time ASC LIMIT 10`,
    [req.user.id]
  );

  res.json({
    greetingName: req.user.name,
    payments: {
      totalAmount,
      totalPaid,
      totalBalance: Math.max(totalAmount - totalPaid, 0),
    },
    salesPipeline,
    todaysTasks: todaysTasksResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      projectName: row.project_name,
      startDate: row.start_date,
      endDate: row.end_date,
      isOverdue: row.is_overdue,
    })),
    upcomingReminders: {
      leadFollowUps: upcomingLeadsResult.rows,
      meetings: upcomingMeetingsResult.rows,
    },
  });
}

module.exports = { overview };
