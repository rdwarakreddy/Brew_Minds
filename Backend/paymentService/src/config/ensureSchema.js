/**
 * ensureSchema.js
 * ---------------------------------------------------------------------
 * PURPOSE
 *   paymentService owns the `payment_projects` junction table (lets one
 *   payment span several projects for the same client). This makes sure
 *   that table exists every time the service starts, independently of
 *   whatever migration tooling did or didn't run against the database --
 *   every statement here uses an IF NOT EXISTS guard, so running it
 *   again on a database that already has the table is a harmless no-op.
 *
 *   This is what stops "relation payment_projects does not exist" from
 *   ever happening again for this service, even if it's deployed/copied
 *   on its own without the rest of the repo's migration step.
 */

const { query } = require('./db');

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS payment_projects (
        payment_id  UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        PRIMARY KEY (payment_id, project_id)
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_payment_projects_project_id ON payment_projects(project_id);`);
  // Backfill: any existing payment with a single project_id but no
  // matching junction-table row yet (e.g. rows created before this
  // table existed) becomes queryable through payment_projects too.
  await query(`
    INSERT INTO payment_projects (payment_id, project_id)
    SELECT id, project_id FROM payments WHERE project_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  `);
}

module.exports = { ensureSchema };
