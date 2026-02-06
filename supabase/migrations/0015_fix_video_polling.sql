-- Migration 0015: Upgrade complete_job RPC for video polling pattern
--
-- Problem: The old complete_job(UUID, TEXT, TEXT) doesn't support updating
-- payload_json or resetting attempts. Video async polling needs both:
-- - Save sora_task_id in payload when re-queuing
-- - Reset attempts counter so polling cycles don't hit MAX_RETRIES
--
-- This replaces the 3-param version with a 5-param version.

-- Drop existing function
DROP FUNCTION IF EXISTS complete_job(UUID, TEXT, TEXT);

-- Create upgraded version with payload + attempts reset support
CREATE OR REPLACE FUNCTION complete_job(
  p_job_id UUID,
  p_status TEXT DEFAULT 'done',
  p_error TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT NULL,
  p_reset_attempts BOOLEAN DEFAULT FALSE
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
    locked_at = NULL,
    -- Only update payload if provided (non-null), otherwise keep existing
    payload_json = COALESCE(p_payload, payload_json),
    -- Reset attempts to 0 if requested (for polling re-queues, not error retries)
    attempts = CASE WHEN p_reset_attempts THEN 0 ELSE attempts END
  WHERE id = p_job_id;

  RETURN FOUND;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION complete_job(UUID, TEXT, TEXT, JSONB, BOOLEAN) TO service_role;

COMMENT ON FUNCTION complete_job(UUID, TEXT, TEXT, JSONB, BOOLEAN) IS
  'Marks a job as complete, optionally updating payload and resetting attempts. Used by video polling pattern.';
