-- FEEDR - Fix RLS Policies
-- Migration: 0014_fix_rls_policies.sql
--
-- Replace USING (true) with user-scoped policies on batches, clips, jobs.
-- Edge functions use service_role which bypasses RLS — unaffected.
-- Presets remain shared.
--
-- IMPORTANT: Before running this migration, backfill orphaned batches:
--   UPDATE batches SET user_id = '<your-user-id>' WHERE user_id IS NULL;

-- ============================================
-- BATCHES - scope to user_id
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can read batches" ON batches;
DROP POLICY IF EXISTS "Authenticated users can insert batches" ON batches;
DROP POLICY IF EXISTS "Authenticated users can update batches" ON batches;
DROP POLICY IF EXISTS "Authenticated users can delete batches" ON batches;

CREATE POLICY "Users can read own batches"
  ON batches FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own batches"
  ON batches FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own batches"
  ON batches FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own batches"
  ON batches FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- CLIPS - scope via batch ownership
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can read clips" ON clips;
DROP POLICY IF EXISTS "Authenticated users can insert clips" ON clips;
DROP POLICY IF EXISTS "Authenticated users can update clips" ON clips;
DROP POLICY IF EXISTS "Authenticated users can delete clips" ON clips;

CREATE POLICY "Users can read own clips"
  ON clips FOR SELECT
  TO authenticated
  USING (batch_id IN (SELECT id FROM batches WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own clips"
  ON clips FOR INSERT
  TO authenticated
  WITH CHECK (batch_id IN (SELECT id FROM batches WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own clips"
  ON clips FOR UPDATE
  TO authenticated
  USING (batch_id IN (SELECT id FROM batches WHERE user_id = auth.uid()))
  WITH CHECK (batch_id IN (SELECT id FROM batches WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own clips"
  ON clips FOR DELETE
  TO authenticated
  USING (batch_id IN (SELECT id FROM batches WHERE user_id = auth.uid()));

-- ============================================
-- JOBS - scope via batch ownership
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can read jobs" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can insert jobs" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can update jobs" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can delete jobs" ON jobs;

CREATE POLICY "Users can read own jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (batch_id IN (SELECT id FROM batches WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (batch_id IN (SELECT id FROM batches WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (batch_id IN (SELECT id FROM batches WHERE user_id = auth.uid()))
  WITH CHECK (batch_id IN (SELECT id FROM batches WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own jobs"
  ON jobs FOR DELETE
  TO authenticated
  USING (batch_id IN (SELECT id FROM batches WHERE user_id = auth.uid()));
