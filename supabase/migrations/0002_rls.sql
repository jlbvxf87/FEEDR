-- FEEDR Terminal Row Level Security
-- Migration: 0002_rls.sql

-- Enable RLS on all tables
ALTER TABLE presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PRESETS POLICIES
-- ============================================
-- Anyone authenticated can read presets
CREATE POLICY "Authenticated users can read presets"
  ON presets FOR SELECT
  TO authenticated
  USING (true);

-- Only authenticated users can manage presets (internal tool)
CREATE POLICY "Authenticated users can insert presets"
  ON presets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update presets"
  ON presets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete presets"
  ON presets FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- BATCHES POLICIES
-- ============================================
CREATE POLICY "Authenticated users can read batches"
  ON batches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert batches"
  ON batches FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update batches"
  ON batches FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete batches"
  ON batches FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- CLIPS POLICIES
-- ============================================
CREATE POLICY "Authenticated users can read clips"
  ON clips FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert clips"
  ON clips FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update clips"
  ON clips FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete clips"
  ON clips FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- JOBS POLICIES
-- ============================================
CREATE POLICY "Authenticated users can read jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete jobs"
  ON jobs FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- SERVICE ROLE BYPASS (for Edge Functions)
-- ============================================
-- Edge functions using service_role key bypass RLS automatically

-- ============================================
-- OPTIONAL: Email Allowlist (uncomment to restrict)
-- ============================================
-- CREATE OR REPLACE FUNCTION is_team_member()
-- RETURNS BOOLEAN AS $$
-- BEGIN
--   RETURN (
--     SELECT email FROM auth.users WHERE id = auth.uid()
--   ) IN (
--     'team@yourcompany.com',
--     'dev@yourcompany.com'
--   );
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Then update policies to use: USING (is_team_member())
