-- ════════════════════════════════════════════════════════════════════════════
-- IDS Platform — Supabase Schema
-- Intermediate Data System trading and Projects CC
--
-- Run this entire script in:
--   Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. DOCUMENTS ─────────────────────────────────────────────────────────────
-- Holds the current (active) version of each client document.
-- Physical files are stored in AWS S3; this table holds metadata only.

CREATE TABLE IF NOT EXISTS documents (
  id                  BIGSERIAL       PRIMARY KEY,
  client_number       TEXT            NOT NULL,
  document_type       TEXT            NOT NULL
                        CHECK (document_type IN (
                          'ID Copy', 'Proof of Address', 'Payslip',
                          'Bank Statement', 'Contract', 'Other'
                        )),
  description         TEXT,
  original_filename   TEXT            NOT NULL,
  stored_filename     TEXT            NOT NULL,
  s3_key              TEXT            NOT NULL,
  file_size           BIGINT          NOT NULL,
  mime_type           TEXT            NOT NULL,
  document_date       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  uploaded_by         TEXT            NOT NULL,
  uploaded_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  version_number      INT             NOT NULL DEFAULT 1,
  is_active           BOOLEAN         NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_documents_client   ON documents (client_number);
CREATE INDEX IF NOT EXISTS idx_documents_type     ON documents (document_type);
CREATE INDEX IF NOT EXISTS idx_documents_active   ON documents (is_active);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded ON documents (uploaded_at DESC);


-- ── 2. DOCUMENT_VERSIONS ─────────────────────────────────────────────────────
-- Archived previous versions — records are NEVER deleted.

CREATE TABLE IF NOT EXISTS document_versions (
  id                  BIGSERIAL       PRIMARY KEY,
  document_id         BIGINT          NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number      INT             NOT NULL,
  original_filename   TEXT            NOT NULL,
  stored_filename     TEXT            NOT NULL,
  s3_key              TEXT            NOT NULL,
  file_size           BIGINT          NOT NULL,
  mime_type           TEXT            NOT NULL,
  uploaded_by         TEXT            NOT NULL,
  uploaded_at         TIMESTAMPTZ     NOT NULL,
  archived_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_document ON document_versions (document_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_number   ON document_versions (document_id, version_number DESC);


-- ── 3. DOCUMENT_AUDIT_LOGS ────────────────────────────────────────────────────
-- Immutable audit trail: who viewed / downloaded / replaced / uploaded, when.

CREATE TABLE IF NOT EXISTS document_audit_logs (
  id            BIGSERIAL   PRIMARY KEY,
  document_id   BIGINT      REFERENCES documents(id) ON DELETE SET NULL,
  action        TEXT        NOT NULL
                  CHECK (action IN (
                    'UPLOAD', 'VIEW', 'DOWNLOAD',
                    'BATCH_DOWNLOAD', 'REPLACE', 'DOWNLOAD_VERSION'
                  )),
  performed_by  TEXT        NOT NULL,
  performed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details       JSONB,
  ip_address    TEXT
);

CREATE INDEX IF NOT EXISTS idx_doc_audit_document  ON document_audit_logs (document_id);
CREATE INDEX IF NOT EXISTS idx_doc_audit_performed ON document_audit_logs (performed_at DESC);


-- ── 4. COMPANY_SETTINGS ───────────────────────────────────────────────────────
-- Single-row table — one record holds the active company configuration.
-- Seeded with IDS defaults on first run by the API.

CREATE TABLE IF NOT EXISTS company_settings (
  id                        INT             PRIMARY KEY DEFAULT 1,
  company_name              TEXT            NOT NULL DEFAULT 'Intermediate Data System trading and Projects CC',
  registration_number       TEXT,
  physical_address          TEXT,
  contact_phone             TEXT,
  contact_email             TEXT,
  logo_s3_key               TEXT,
  logo_url                  TEXT,
  email_signature           TEXT,
  default_currency          TEXT            NOT NULL DEFAULT 'ZAR',
  fiscal_year_start_month   INT             NOT NULL DEFAULT 3
                              CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  updated_by                TEXT,
  updated_at                TIMESTAMPTZ     DEFAULT NOW(),
  created_at                TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  -- Enforce single row
  CONSTRAINT company_settings_single_row CHECK (id = 1)
);

-- Seed the default row if it doesn't exist
INSERT INTO company_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;


-- ── 5. COMPANY_SETTINGS_AUDIT ─────────────────────────────────────────────────
-- Field-level change history for company settings.

CREATE TABLE IF NOT EXISTS company_settings_audit (
  id          BIGSERIAL   PRIMARY KEY,
  settings_id INT         NOT NULL REFERENCES company_settings(id),
  field_name  TEXT        NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  changed_by  TEXT        NOT NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_co_settings_audit ON company_settings_audit (settings_id, changed_at DESC);


-- ── 6. BUSINESS_RULES ─────────────────────────────────────────────────────────
-- Single-row table of configurable loan business rules.

CREATE TABLE IF NOT EXISTS business_rules (
  id                                INT             PRIMARY KEY DEFAULT 1,
  min_loan_amount                   NUMERIC(15, 2)  NOT NULL DEFAULT 10000.00,
  max_loan_amount                   NUMERIC(15, 2)  NOT NULL DEFAULT 5000000.00,
  min_loan_term_months              INT             NOT NULL DEFAULT 1,
  max_loan_term_months              INT             NOT NULL DEFAULT 24,
  max_concurrent_loans_per_client   INT             NOT NULL DEFAULT 3,
  min_credit_score_auto_approve     INT             NOT NULL DEFAULT 80
                                      CHECK (min_credit_score_auto_approve BETWEEN 0 AND 100),
  days_to_default                   INT             NOT NULL DEFAULT 90,
  interest_calculation_method       TEXT            NOT NULL DEFAULT 'reducing_balance'
                                      CHECK (interest_calculation_method IN (
                                        'reducing_balance', 'flat_rate', 'add_on'
                                      )),
  payment_allocation_priority       TEXT            NOT NULL DEFAULT 'interest_first'
                                      CHECK (payment_allocation_priority IN (
                                        'interest_first', 'principal_first', 'proportional'
                                      )),
  updated_by                        TEXT,
  updated_at                        TIMESTAMPTZ     DEFAULT NOW(),
  created_at                        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT business_rules_single_row CHECK (id = 1)
);

INSERT INTO business_rules (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;


-- ── 7. BUSINESS_RULES_AUDIT ───────────────────────────────────────────────────
-- Field-level change history for business rules.
-- Stores old value, new value, who changed it, when — and override reason if applicable.

CREATE TABLE IF NOT EXISTS business_rules_audit (
  id          BIGSERIAL   PRIMARY KEY,
  rules_id    INT         NOT NULL REFERENCES business_rules(id),
  field_name  TEXT        NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  changed_by  TEXT        NOT NULL,    -- includes override note when overridden
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_biz_rules_audit ON business_rules_audit (rules_id, changed_at DESC);


-- ── 8. ROW LEVEL SECURITY ─────────────────────────────────────────────────────
-- Enable RLS on all tables. Default policies allow authenticated users full access.
-- Tighten these to match your auth strategy before going to production.

ALTER TABLE documents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_audit_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings_audit  ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_rules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_rules_audit    ENABLE ROW LEVEL SECURITY;

-- Documents
CREATE POLICY "Auth users can read documents"
  ON documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert documents"
  ON documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update documents"
  ON documents FOR UPDATE TO authenticated USING (true);

-- Document versions (append-only)
CREATE POLICY "Auth users can read versions"
  ON document_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert versions"
  ON document_versions FOR INSERT TO authenticated WITH CHECK (true);

-- Document audit (append-only)
CREATE POLICY "Auth users can read doc audit"
  ON document_audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert doc audit"
  ON document_audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Company settings (admin should be restricted at app layer)
CREATE POLICY "Auth users can read company settings"
  ON company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can update company settings"
  ON company_settings FOR UPDATE TO authenticated USING (true);

-- Company settings audit (append-only)
CREATE POLICY "Auth users can read company settings audit"
  ON company_settings_audit FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert company settings audit"
  ON company_settings_audit FOR INSERT TO authenticated WITH CHECK (true);

-- Business rules (admin should be restricted at app layer)
CREATE POLICY "Auth users can read business rules"
  ON business_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can update business rules"
  ON business_rules FOR UPDATE TO authenticated USING (true);

-- Business rules audit (append-only)
CREATE POLICY "Auth users can read business rules audit"
  ON business_rules_audit FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert business rules audit"
  ON business_rules_audit FOR INSERT TO authenticated WITH CHECK (true);


-- ── 9. S3 STORAGE BUCKET (reference) ─────────────────────────────────────────
-- Files are stored in AWS S3, not Supabase Storage.
-- This comment documents the expected S3 folder structure:
--
--   {bucket}/
--   └── clients/
--       └── {client_number}/
--           ├── active/
--           │   └── CLIENT001_ID_Copy_20250411_filename.pdf
--           └── archive/
--               └── v1_CLIENT001_ID_Copy_20250101_old.pdf
--   └── system/
--       └── logo/
--           └── company_logo.png


-- ── 10. USEFUL VIEWS ──────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW documents_with_history AS
SELECT
  d.*,
  COUNT(v.id) AS archived_version_count
FROM documents d
LEFT JOIN document_versions v ON v.document_id = d.id
GROUP BY d.id;
