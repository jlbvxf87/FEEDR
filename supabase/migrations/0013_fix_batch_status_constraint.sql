-- FEEDR - Fix Batch Status Constraint
-- Migration: 0013_fix_batch_status_constraint.sql
--
-- The worker sets status = 'researching' and checks for 'cancelled',
-- but the original constraint only allows: queued, running, done, failed.

-- Drop the old inline constraint
ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_status_check;

-- Add new constraint with all valid statuses
ALTER TABLE batches ADD CONSTRAINT batches_status_check
  CHECK (status IN ('queued', 'researching', 'running', 'done', 'failed', 'cancelled'));
