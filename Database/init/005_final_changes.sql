-- =====================================================================
-- 005_final_changes.sql
-- ---------------------------------------------------------------------
-- PURPOSE
--   Implements the final round of product changes:
--     1. Clients cascade-delete their Projects (previously projects
--        were only orphaned via SET NULL, which left "ghost" projects
--        with no client behind).
--     2. Leads & Projects can each have their own Currency.
--     3. Meetings can now be linked to a Lead (in addition to Client /
--        Project), and track a status (scheduled/completed/cancelled)
--        + duration, which powers the new "Meeting History" section
--        and the "No. of meetings" counters shown on Leads/Clients/
--        Projects.
--     4. Documents: a Project may only be chosen if a Client is also
--        chosen (a Client alone is fine on its own).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Clients -> Projects should CASCADE delete, not SET NULL.
-- ---------------------------------------------------------------------
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_client_id_fkey;
ALTER TABLE projects
    ADD CONSTRAINT projects_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------
-- 2. Currency on Leads & Projects.
-- ---------------------------------------------------------------------
ALTER TABLE leads ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'USD';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'USD';

-- ---------------------------------------------------------------------
-- 3. Meetings: link to a Lead, add status + duration.
-- ---------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE meeting_status AS ENUM ('scheduled', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS status meeting_status NOT NULL DEFAULT 'scheduled';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 30;

CREATE INDEX IF NOT EXISTS idx_meetings_lead_id ON meetings(lead_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);

-- Backfill: any meeting whose date+time has already passed and was
-- never explicitly cancelled is treated as completed, so History has
-- sensible data immediately after this migration runs.
UPDATE meetings
SET status = 'completed'
WHERE status = 'scheduled'
  AND (meeting_date + meeting_time) < NOW();

-- ---------------------------------------------------------------------
-- 4. Documents: Project requires a Client.
-- ---------------------------------------------------------------------
-- Clean up any pre-existing rows that would violate the new rule
-- (a project chosen with no client) before adding the constraint, so
-- the migration itself never fails on real data.
UPDATE documents SET project_id = NULL WHERE project_id IS NOT NULL AND client_id IS NULL;

-- Implemented as a DEFERRABLE constraint trigger rather than a plain
-- CHECK constraint. Reason: Postgres does not allow CHECK constraints
-- to be DEFERRABLE, but this rule needs to be -- deleting a Client
-- cascades to delete its Projects (see #1 above) AND independently
-- sets any of that Client's Documents' client_id to NULL, all within
-- the same statement. A document that references both is updated
-- TWICE in that one statement (once when its project disappears, once
-- when its client disappears); a plain CHECK would be evaluated
-- against the row's momentarily-inconsistent in-between state and
-- incorrectly reject the whole delete. Deferring the check to the end
-- of the transaction, and re-reading the row's CURRENT values rather
-- than trusting the trigger's own NEW snapshot, makes the rule judge
-- only the final, settled state.
ALTER TABLE documents DROP CONSTRAINT IF EXISTS chk_documents_project_requires_client;
DROP TRIGGER IF EXISTS trg_documents_project_requires_client ON documents;
DROP FUNCTION IF EXISTS check_document_project_requires_client();

CREATE FUNCTION check_document_project_requires_client() RETURNS TRIGGER AS $$
DECLARE
  current_project_id UUID;
  current_client_id UUID;
BEGIN
  SELECT project_id, client_id INTO current_project_id, current_client_id
  FROM documents WHERE id = NEW.id;

  IF current_project_id IS NOT NULL AND current_client_id IS NULL THEN
    RAISE EXCEPTION 'A document with a project must also have a client.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_documents_project_requires_client
AFTER INSERT OR UPDATE ON documents
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_document_project_requires_client();
