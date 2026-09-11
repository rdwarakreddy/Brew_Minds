-- =====================================================================
-- 002_schema.sql
-- ---------------------------------------------------------------------
-- Purpose : Creates every table used by the Freelancer Management
--           Platform. Even though the backend is split into many
--           microservices (authService, leadService, clientService...)
--           they all talk to ONE Postgres database. This is a common,
--           pragmatic pattern for small/medium microservice systems --
--           it avoids the huge complexity of cross-service transactions
--           and data-duplication while still keeping each service's
--           CODE independently deployable and organizationally
--           separated. Each service only queries the tables it owns.
--
-- Why UUIDs        : see 001_extensions.sql
-- Why TIMESTAMPTZ  : always store time with timezone so the app is
--                    correct no matter where the server or the user is.
-- Why triggers      : `updated_at` is maintained automatically by a
--                    trigger instead of relying on every service to
--                    remember to set it on every UPDATE -- one less
--                    thing that can be forgotten/bugged in application
--                    code.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper trigger function: automatically bump `updated_at` on any UPDATE
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- USERS  (owned by authService)
-- ---------------------------------------------------------------------
-- Every freelancer who uses the app is a "user". A user can either:
--   1. Register manually  -> password_hash is set, google_id is NULL
--   2. Sign up with Google -> google_id is set, password_hash is NULL
-- We allow both so the same email could technically link either way,
-- but we enforce a unique email so one person = one account either way.
-- =====================================================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   TEXT,                         -- NULL when signed up via Google
    google_id       VARCHAR(255) UNIQUE,           -- NULL when registered manually
    avatar_url      TEXT,
    company_name    VARCHAR(150),                  -- shown at the top of the sidebar
    phone           VARCHAR(30),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- A user must have EITHER a password OR a google_id (or both) --
    -- never neither, otherwise the account would be un-loginable.
    CONSTRAINT chk_users_has_login_method
        CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)
);
CREATE OR REPLACE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Refresh tokens are stored so a user can be logged out server-side
-- (deleting the row invalidates the refresh token immediately), and so
-- we can support "logout of all devices".
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,           -- we store a HASH, never the raw token
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- =====================================================================
-- CLIENTS  (owned by clientService)
-- =====================================================================
CREATE TABLE IF NOT EXISTS clients (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name              VARCHAR(150) NOT NULL,
    phone             VARCHAR(30),
    email             VARCHAR(255),
    invoice_currency  VARCHAR(10) NOT NULL DEFAULT 'USD',
    country           VARCHAR(100),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);

-- =====================================================================
-- LEADS  (owned by leadService) -- Kanban board, drag between statuses
-- =====================================================================
DO $$ BEGIN
CREATE TYPE lead_status AS ENUM (
    'new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost'
);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS leads (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                VARCHAR(150) NOT NULL,
    phone               VARCHAR(30),
    email               VARCHAR(255),
    country             VARCHAR(100),
    estimated_budget    NUMERIC(14,2),
    status              lead_status NOT NULL DEFAULT 'new',
    source              VARCHAR(100),               -- e.g. Referral, LinkedIn, Upwork
    next_followup_at    TIMESTAMPTZ,
    notes               TEXT,
    -- position within its status column, so drag-and-drop re-ordering
    -- can be persisted (not just the column itself)
    board_position      INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE TRIGGER trg_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON leads(next_followup_at);

-- =====================================================================
-- PROJECTS  (owned by projectService) -- also a Kanban board
-- =====================================================================
DO $$ BEGIN
CREATE TYPE project_status AS ENUM (
    'new', 'ongoing', 'on_hold', 'completed', 'cancelled'
);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    status          project_status NOT NULL DEFAULT 'new',
    budget          NUMERIC(14,2) NOT NULL DEFAULT 0,
    start_date      DATE,
    end_date        DATE,
    board_position  INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- =====================================================================
-- PAYMENTS  (owned by paymentService)
-- ---------------------------------------------------------------------
-- Payments are entered manually (no payment-gateway integration). The
-- "amount paid" for a project = SUM(payments.amount) WHERE project_id.
-- "Due amount" for a project = projects.budget - SUM(payments.amount).
-- We do NOT store a duplicated "paid so far" column on projects to
-- avoid the classic bug of two numbers drifting out of sync -- it is
-- always calculated live from this table (see dashboardService).
-- =====================================================================
CREATE TABLE IF NOT EXISTS payments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
    client_id     UUID REFERENCES clients(id) ON DELETE SET NULL,
    title         VARCHAR(200) NOT NULL,
    amount        NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    payment_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_project_id ON payments(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- =====================================================================
-- MEETINGS  (owned by meetingService) -- Google-Calendar-like view
-- =====================================================================
CREATE TABLE IF NOT EXISTS meetings (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id              UUID REFERENCES clients(id) ON DELETE SET NULL,
    project_id             UUID REFERENCES projects(id) ON DELETE SET NULL,
    title                  VARCHAR(200) NOT NULL,
    description            TEXT,
    meeting_date           DATE NOT NULL,
    meeting_time           TIME NOT NULL,
    google_meet_link       TEXT,
    remind_before_minutes  INTEGER NOT NULL DEFAULT 10,
    reminder_sent          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE TRIGGER trg_meetings_updated_at
    BEFORE UPDATE ON meetings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date);
-- Composite index used by the reminder-scanning job (see notificationService)
CREATE INDEX IF NOT EXISTS idx_meetings_reminder_scan ON meetings(reminder_sent, meeting_date, meeting_time);

-- =====================================================================
-- TASKS  (owned by taskService) -- Kanban board with overdue highlighting
-- =====================================================================
DO $$ BEGIN
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'completed');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
    client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
    name            VARCHAR(200) NOT NULL,
    status          task_status NOT NULL DEFAULT 'todo',
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    board_position  INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_tasks_dates CHECK (end_date >= start_date)
);
CREATE OR REPLACE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_dates ON tasks(start_date, end_date);

-- =====================================================================
-- DOCUMENTS  (owned by documentService) -- uploaded files OR links
-- =====================================================================
DO $$ BEGIN
CREATE TYPE document_type AS ENUM ('file', 'link');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS documents (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
    client_id     UUID REFERENCES clients(id) ON DELETE SET NULL,
    name          VARCHAR(200) NOT NULL,
    type          document_type NOT NULL,
    file_path     TEXT,   -- set when type = 'file' (path on disk / object storage key)
    file_size     BIGINT, -- bytes, set when type = 'file'
    link_url      TEXT,   -- set when type = 'link'
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_documents_type_payload CHECK (
        (type = 'file' AND file_path IS NOT NULL) OR
        (type = 'link' AND link_url IS NOT NULL)
    )
);
CREATE OR REPLACE TRIGGER trg_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);

-- =====================================================================
-- INVOICES  (owned by invoiceService)
-- ---------------------------------------------------------------------
-- The invoice "template" fields (issuer name/address/phone/email/bank
-- details, GST, currency, line items) vary in shape/count, so the
-- flexible parts are stored as JSONB while the fields we need to
-- query/filter/report on (client, project, totals, status) are kept as
-- normal relational columns. This hybrid approach is a common, sane
-- middle ground -- full JSON would make reporting hard, full
-- normalization (a separate row per possible field) would be overkill.
-- =====================================================================
DO $$ BEGIN
CREATE TYPE invoice_status AS ENUM ('draft', 'saved', 'paid');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS invoices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id         UUID REFERENCES clients(id) ON DELETE SET NULL,
    project_id        UUID REFERENCES projects(id) ON DELETE SET NULL,
    -- Reference ID is generated by the application (see invoiceService)
    -- in the form INV-2026-0001 and can never be edited by the user.
    reference_id      VARCHAR(50) NOT NULL UNIQUE,
    issuer_details    JSONB NOT NULL DEFAULT '{}'::JSONB, -- name/address/phone/email/bank
    line_items        JSONB NOT NULL DEFAULT '[]'::JSONB, -- [{description, qty, rate, amount}]
    currency          VARCHAR(10) NOT NULL DEFAULT 'USD',
    gst_applicable    BOOLEAN NOT NULL DEFAULT FALSE,
    gst_percentage    NUMERIC(5,2) NOT NULL DEFAULT 0,
    subtotal_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,
    gst_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
    amount_in_words   TEXT,
    status            invoice_status NOT NULL DEFAULT 'draft',
    issue_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date          DATE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);

-- A tiny counter table used to generate sequential, gap-aware invoice
-- reference numbers per user, per year (INV-2026-0001, INV-2026-0002).
CREATE TABLE IF NOT EXISTS invoice_counters (
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year          INTEGER NOT NULL,
    last_number   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, year)
);

-- =====================================================================
-- NOTIFICATIONS  (owned by notificationService)
-- ---------------------------------------------------------------------
-- Bell-icon notifications: meeting reminders, follow-up reminders, etc.
-- =====================================================================
DO $$ BEGIN
CREATE TYPE notification_type AS ENUM ('meeting_reminder', 'lead_followup', 'system');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        notification_type NOT NULL DEFAULT 'system',
    title       VARCHAR(200) NOT NULL,
    message     TEXT,
    -- optional pointer back to the record this notification is about
    reference_table  VARCHAR(50),
    reference_id      UUID,
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, is_read);
