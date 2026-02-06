-- FEEDR - Reliability Fixes
-- Migration: 0018_reliability_fixes.sql
--
-- Ensures batch status constraints match runtime states and clips have updated_at.

-- ============================================
-- BATCH STATUS CONSTRAINT (allow researching/cancelled)
-- ============================================
ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_status_check;
ALTER TABLE batches ADD CONSTRAINT batches_status_check
  CHECK (status IN ('queued', 'researching', 'running', 'done', 'failed', 'cancelled'));

-- ============================================
-- CLIPS UPDATED_AT + TRIGGER
-- ============================================
ALTER TABLE clips
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Keep updated_at fresh on updates
CREATE OR REPLACE FUNCTION set_clips_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_clips_updated_at ON clips;

CREATE TRIGGER set_clips_updated_at
BEFORE UPDATE ON clips
FOR EACH ROW
EXECUTE FUNCTION set_clips_updated_at();

