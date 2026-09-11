-- =====================================================================
-- 003_payment_projects.sql
-- ---------------------------------------------------------------------
-- PURPOSE
--   Lets a single payment be associated with MORE THAN ONE project for
--   the same client (e.g. a freelancer receives one lump-sum transfer
--   that covers work across two ongoing projects for that client).
--
--   `payments.project_id` (singular) is kept for backwards
--   compatibility and as a quick "primary" project reference, but the
--   authoritative set of projects a payment applies to is now this
--   junction table. paymentService writes to BOTH on create so existing
--   single-project reads keep working unchanged.
-- =====================================================================

CREATE TABLE IF NOT EXISTS payment_projects (
    payment_id  UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    PRIMARY KEY (payment_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_projects_project_id ON payment_projects(project_id);

-- Backfill: every existing payment that already has a single project_id
-- gets a matching row here, so historical data is queryable through the
-- new junction table too.
INSERT INTO payment_projects (payment_id, project_id)
SELECT id, project_id FROM payments WHERE project_id IS NOT NULL
ON CONFLICT DO NOTHING;
