/**
 * reminderScanner.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Implements: "Remind me before (X minutes) -- a notification needs
 *   to be triggered." Runs on a schedule (every minute by default,
 *   configurable via REMINDER_SCAN_CRON) and:
 *
 *     1. Finds meetings where (meeting_date + meeting_time) minus
 *        remind_before_minutes has already passed, but the meeting
 *        itself hasn't happened yet, and reminder_sent is still false.
 *     2. Inserts a notification row for that meeting's owner.
 *     3. Flips reminder_sent = true so the same meeting never creates a
 *        duplicate notification.
 *
 * WHY A SEPARATE BACKGROUND JOB INSTEAD OF CHECKING ON EVERY REQUEST
 *   Meeting reminders need to fire even if the user isn't actively
 *   using the app at that exact moment (that's the whole point of a
 *   reminder) -- so this has to run independently on a timer, not just
 *   "when the user happens to load the Notifications bell".
 */

const cron = require('node-cron');
const { query } = require('../config/db');

async function scanForDueReminders() {
  try {
    // A meeting's "remind at" instant = meeting_date + meeting_time - remind_before_minutes.
    // We select meetings where that instant has already passed (<=NOW())
    // but the meeting itself is still in the future (so we don't spam
    // reminders for meetings that already happened, e.g. after downtime).
    const dueResult = await query(`
      SELECT m.*, c.name AS client_name
      FROM meetings m
      LEFT JOIN clients c ON c.id = m.client_id
      WHERE m.reminder_sent = FALSE
        AND (m.meeting_date + m.meeting_time) > NOW()
        AND (m.meeting_date + m.meeting_time) - (m.remind_before_minutes || ' minutes')::INTERVAL <= NOW()
    `);

    for (const meeting of dueResult.rows) {
      const timeLabel = meeting.meeting_time.slice(0, 5);
      await query(
        `INSERT INTO notifications (user_id, type, title, message, reference_table, reference_id)
         VALUES ($1, 'meeting_reminder', $2, $3, 'meetings', $4)`,
        [
          meeting.user_id,
          `Upcoming: ${meeting.title}`,
          `Starts at ${timeLabel} on ${meeting.meeting_date}${meeting.client_name ? ` with ${meeting.client_name}` : ''}.`,
          meeting.id,
        ]
      );
      await query('UPDATE meetings SET reminder_sent = TRUE WHERE id = $1', [meeting.id]);
    }

    if (dueResult.rows.length > 0) {
      console.log(`[notificationService] Created ${dueResult.rows.length} meeting reminder notification(s).`);
    }
  } catch (err) {
    console.error('[notificationService] reminderScanner failed:', err.message);
  }
}

/**
 * Creates a notification once per lead when its next_followup_at
 * crosses into the "due now" window (has arrived but the lead hasn't
 * been re-flagged yet). We detect "already notified" by checking
 * whether a notification pointing at this lead already exists, since
 * leads (unlike meetings) don't have their own reminder_sent column.
 */
async function scanForDueFollowUps() {
  try {
    const dueResult = await query(`
      SELECT l.*
      FROM leads l
      WHERE l.next_followup_at IS NOT NULL
        AND l.next_followup_at <= NOW()
        AND l.status NOT IN ('won', 'lost')
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.reference_table = 'leads' AND n.reference_id = l.id
            AND n.created_at > l.next_followup_at - INTERVAL '1 day'
        )
    `);

    for (const lead of dueResult.rows) {
      await query(
        `INSERT INTO notifications (user_id, type, title, message, reference_table, reference_id)
         VALUES ($1, 'lead_followup', $2, $3, 'leads', $4)`,
        [
          lead.user_id,
          `Follow up with ${lead.name}`,
          `A follow-up was scheduled for this lead and is now due.`,
          lead.id,
        ]
      );
    }

    if (dueResult.rows.length > 0) {
      console.log(`[notificationService] Created ${dueResult.rows.length} lead follow-up notification(s).`);
    }
  } catch (err) {
    console.error('[notificationService] follow-up scanner failed:', err.message);
  }
}

// Flips any meeting whose date+time has passed from 'scheduled' to
// 'completed' -- keeps the Meeting History section and the meeting
// counters on Leads/Clients/Projects accurate in the background, not
// just the instant someone happens to open the Meetings section
// (meetingService also does this defensively on read, see
// meetingController.autoCompletePastMeetings).
async function scanForCompletedMeetings() {
  try {
    await query(
      `UPDATE meetings SET status = 'completed'
       WHERE status = 'scheduled' AND (meeting_date + meeting_time) < NOW()`
    );
  } catch (err) {
    console.error('[notificationService] completed-meeting scanner failed:', err.message);
  }
}

function startReminderScanner() {
  const schedule = process.env.REMINDER_SCAN_CRON || '* * * * *';
  cron.schedule(schedule, scanForDueReminders);
  cron.schedule(schedule, scanForDueFollowUps);
  cron.schedule(schedule, scanForCompletedMeetings);
  console.log(`[notificationService] Reminder scanner scheduled: "${schedule}"`);
}

module.exports = { startReminderScanner, scanForDueReminders, scanForDueFollowUps };
