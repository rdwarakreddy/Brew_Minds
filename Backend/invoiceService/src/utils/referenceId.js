/**
 * referenceId.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Generates the application-assigned, non-editable invoice reference
 *   number in the form INV-2026-0001, unique per user per year, and
 *   guaranteed gap-free/sequential (never reused, never duplicated)
 *   even if two invoices are created at almost the same instant.
 *
 * HOW IT AVOIDS RACE CONDITIONS
 *   We use Postgres's `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`
 *   ("upsert") against the `invoice_counters` table, which atomically
 *   increments `last_number` in a single statement. Two concurrent
 *   requests can never read-then-write the same number, because the
 *   increment happens inside Postgres itself, not in application code.
 */

const { query } = require('../config/db');

async function generateReferenceId(userId) {
  const year = new Date().getFullYear();

  const result = await query(
    `INSERT INTO invoice_counters (user_id, year, last_number)
     VALUES ($1, $2, 1)
     ON CONFLICT (user_id, year)
     DO UPDATE SET last_number = invoice_counters.last_number + 1
     RETURNING last_number`,
    [userId, year]
  );

  const number = result.rows[0].last_number;
  return `INV-${year}-${String(number).padStart(4, '0')}`;
}

module.exports = { generateReferenceId };
