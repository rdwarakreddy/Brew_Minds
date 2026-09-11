-- =====================================================================
-- seed.sql (OPTIONAL)
-- ---------------------------------------------------------------------
-- Purpose : Sample data so the UI isn't empty on first run. This is
--           NOT executed automatically (it lives outside /init and
--           /migrations on purpose) -- run it yourself only if you want
--           demo data:
--
--   docker exec -i freelancer_postgres psql -U freelancer_admin -d freelancer_db < Database/seed/seed.sql
--
-- Login with: demo@freelancer.app / Password123!
--   docker exec -i brew_minds_postgres psql -U Brew_Minds -d Brew_Minds_db < Database/seed/seed.sql
-- =====================================================================

-- Password hash below is bcrypt("Password123!", 10 rounds)
INSERT INTO users (id, name, email, password_hash, company_name, phone)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Alex Rivera',
    'demo@freelancer.app',
    '$2b$10$DZqo7DQRck3v6olKrjIeBOHyag.pPGMtrqMUo4KjkaIAkTdEN1fIe',
    'Rivera Design Studio',
    '+1 555 010 2020'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO clients (id, user_id, name, phone, email, invoice_currency, country)
VALUES
    ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'Nova Retail Co.', '+1 555 200 1000', 'accounts@novaretail.com', 'USD', 'United States'),
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Bluepeak Studios', '+44 20 7946 0958', 'finance@bluepeak.io', 'GBP', 'United Kingdom')
ON CONFLICT DO NOTHING;

INSERT INTO projects (id, user_id, client_id, name, description, status, budget, start_date, end_date)
VALUES
    ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', 'Brand Identity Refresh', 'Full logo, colour system and brand guidelines.', 'ongoing', 8000, CURRENT_DATE - 10, CURRENT_DATE + 20),
    ('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Marketing Website', 'Design + build a 6-page marketing site.', 'new', 5200, CURRENT_DATE + 2, CURRENT_DATE + 45)
ON CONFLICT DO NOTHING;

INSERT INTO payments (user_id, project_id, client_id, title, amount, payment_date)
VALUES
    ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222221', 'Advance payment', 3000, CURRENT_DATE - 8)
ON CONFLICT DO NOTHING;

INSERT INTO leads (user_id, name, phone, email, country, estimated_budget, status, source, next_followup_at, notes)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Priya Shah', '+91 98765 43210', 'priya@shahventures.com', 'India', 4500, 'new', 'LinkedIn', NOW() + INTERVAL '2 days', 'Interested in a full dashboard redesign.'),
    ('11111111-1111-1111-1111-111111111111', 'Marco Duarte', '+351 912 345 678', 'marco@duartetech.pt', 'Portugal', 12000, 'proposal_sent', 'Referral', NOW() + INTERVAL '5 days', 'Sent proposal, awaiting sign off.')
ON CONFLICT DO NOTHING;

INSERT INTO tasks (user_id, project_id, client_id, name, status, start_date, end_date)
VALUES
    ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222221', 'Design moodboard', 'completed', CURRENT_DATE - 9, CURRENT_DATE - 6),
    ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222221', 'Logo concepts', 'in_progress', CURRENT_DATE - 3, CURRENT_DATE + 2),
    ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222', 'Sitemap & wireframes', 'todo', CURRENT_DATE - 2, CURRENT_DATE + 1)
ON CONFLICT DO NOTHING;
