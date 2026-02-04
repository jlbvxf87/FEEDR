-- FEEDR - Robust Queue System
-- Migration: 0009_robust_queue.sql
--
-- This migration adds atomic job claiming and idempotent job creation
-- to prevent race conditions and duplicate processing.

-- ============================================
-- ADD MISSING COLUMNS TO JOBS TABLE
-- ============================================

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

-- Add locked_at column for distributed locking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'locked_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN locked_at TIMESTAMPTZ NULL;
  END IF;
END $$;

-- Create index for efficient queue queries
CREATE INDEX IF NOT EXISTS idx_jobs_queue_priority 
ON jobs(status, created_at) 
WHERE status = 'queued';

-- ============================================
-- ATOMIC JOB CLAIMING FUNCTION
-- ============================================
-- Uses FOR UPDATE SKIP LOCKED to prevent race conditions
-- when multiple workers try to claim the same job

CREATE OR REPLACE FUNCTION claim_next_job()
RETURNS TABLE (
  job_id UUID,
  job_type TEXT,
  job_batch_id UUID,
  job_clip_id UUID,
  job_payload JSONB,
  job_attempts INT,
  job_error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job RECORD;
BEGIN
  -- Select and lock the oldest queued job atomically
  -- SKIP LOCKED ensures concurrent workers don't block each other
  SELECT * INTO v_job
  FROM jobs
  WHERE status = 'queued'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  -- If no job available, return empty
  IF v_job IS NULL THEN
    RETURN;
  END IF;
  
  -- Atomically update the job to running status
  UPDATE jobs SET 
    status = 'running',
    attempts = v_job.attempts + 1,
    updated_at = now(),
    locked_at = now(),
    error = NULL  -- Clear previous error on retry
  WHERE id = v_job.id;
  
  -- Return the claimed job
  RETURN QUERY SELECT 
    v_job.id,
    v_job.type,
    v_job.batch_id,
    v_job.clip_id,
    v_job.payload_json,
    v_job.attempts + 1,
    v_job.error;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION claim_next_job() TO service_role;

COMMENT ON FUNCTION claim_next_job() IS 
  'Atomically claims the next queued job for processing. Uses FOR UPDATE SKIP LOCKED to prevent race conditions.';

-- ============================================
-- IDEMPOTENT CHILD JOB CREATION FUNCTION
-- ============================================
-- Creates a child job only if one doesn't already exist
-- Prevents duplicate jobs on retry of parent job

CREATE OR REPLACE FUNCTION create_child_job_if_not_exists(
  p_batch_id UUID,
  p_clip_id UUID,
  p_type TEXT,
  p_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_id UUID;
  v_new_id UUID;
BEGIN
  -- Check for existing job of this type for this clip (or batch if no clip)
  IF p_clip_id IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM jobs
    WHERE clip_id = p_clip_id
      AND type = p_type
      AND status != 'failed'  -- Allow re-creation if previous failed
    LIMIT 1;
  ELSE
    -- For batch-level jobs (like compile), check by batch_id and type
    SELECT id INTO v_existing_id
    FROM jobs
    WHERE batch_id = p_batch_id
      AND clip_id IS NULL
      AND type = p_type
      AND status != 'failed'
    LIMIT 1;
  END IF;
  
  -- If exists, return existing job id
  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;
  
  -- Create new job
  INSERT INTO jobs (batch_id, clip_id, type, status, payload_json, attempts)
  VALUES (p_batch_id, p_clip_id, p_type, 'queued', p_payload, 0)
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION create_child_job_if_not_exists(UUID, UUID, TEXT, JSONB) TO service_role;

COMMENT ON FUNCTION create_child_job_if_not_exists(UUID, UUID, TEXT, JSONB) IS 
  'Creates a child job only if one does not already exist. Provides idempotency for job creation on retries.';

-- ============================================
-- JOB COMPLETION HELPER
-- ============================================
-- Marks a job as done and updates timestamps

CREATE OR REPLACE FUNCTION complete_job(
  p_job_id UUID,
  p_status TEXT DEFAULT 'done',
  p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE jobs SET
    status = p_status,
    error = p_error,
    updated_at = now(),
    locked_at = NULL  -- Release lock
  WHERE id = p_job_id;
  
  RETURN FOUND;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION complete_job(UUID, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION complete_job(UUID, TEXT, TEXT) IS 
  'Marks a job as complete (done or failed) and releases the lock.';

-- ============================================
-- HEARTBEAT FUNCTION FOR LONG-RUNNING JOBS
-- ============================================
-- Updates the locked_at timestamp to indicate the job is still being processed

CREATE OR REPLACE FUNCTION job_heartbeat(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE jobs SET
    updated_at = now(),
    locked_at = now()
  WHERE id = p_job_id
    AND status = 'running';
  
  RETURN FOUND;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION job_heartbeat(UUID) TO service_role;

COMMENT ON FUNCTION job_heartbeat(UUID) IS 
  'Updates timestamps for a running job to indicate it is still being processed. Call periodically for long jobs.';

-- ============================================
-- RESET STUCK JOBS FUNCTION
-- ============================================
-- Resets jobs that have been running too long (likely crashed workers)

CREATE OR REPLACE FUNCTION reset_stuck_jobs(p_threshold_minutes INT DEFAULT 20)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  WITH stuck AS (
    UPDATE jobs SET
      status = 'queued',
      error = 'Reset: job exceeded ' || p_threshold_minutes || ' minute threshold',
      locked_at = NULL,
      updated_at = now()
    WHERE status = 'running'
      AND updated_at < now() - (p_threshold_minutes || ' minutes')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM stuck;
  
  RETURN v_count;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION reset_stuck_jobs(INT) TO service_role;

COMMENT ON FUNCTION reset_stuck_jobs(INT) IS 
  'Resets jobs that have been running longer than the threshold. Returns count of reset jobs.';
