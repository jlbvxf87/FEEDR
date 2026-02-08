-- Add UX state fields for clips and helper RPC

ALTER TABLE clips
  ADD COLUMN IF NOT EXISTS ui_state TEXT NOT NULL DEFAULT 'queued'
    CHECK (ui_state IN (
      'queued','writing','voicing','submitting','rendering','rendering_delayed',
      'assembling','ready','failed_not_charged','failed_charged','canceled'
    )),
  ADD COLUMN IF NOT EXISTS ui_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ui_last_progress_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS ui_message TEXT NULL,
  ADD COLUMN IF NOT EXISTS provider TEXT NULL,
  ADD COLUMN IF NOT EXISTS provider_task_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS charged_state TEXT NOT NULL DEFAULT 'unknown'
    CHECK (charged_state IN ('unknown','not_charged','charged'));

CREATE INDEX IF NOT EXISTS idx_clips_ui_state ON clips(ui_state);

CREATE OR REPLACE FUNCTION set_clip_ui_state(
  p_clip_id uuid,
  p_ui_state text,
  p_message text default null,
  p_provider text default null,
  p_provider_task_id text default null,
  p_charged_state text default null
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE clips
  SET ui_state = p_ui_state,
      ui_message = COALESCE(p_message, ui_message),
      provider = COALESCE(p_provider, provider),
      provider_task_id = COALESCE(p_provider_task_id, provider_task_id),
      charged_state = COALESCE(p_charged_state, charged_state),
      ui_last_progress_at = now(),
      updated_at = now()
  WHERE id = p_clip_id;
END;
$$;

GRANT EXECUTE ON FUNCTION set_clip_ui_state(uuid, text, text, text, text, text) TO service_role;

COMMENT ON FUNCTION set_clip_ui_state(uuid, text, text, text, text, text) IS
  'Updates clip UI state and optional provider metadata without altering job control plane.';

-- Prevent stuck reset from fighting in-flight video polling jobs
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
      AND NOT (
        type = 'video'
        AND (payload_json ? 'sora_task_id')
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM stuck;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION reset_stuck_jobs(INT) TO service_role;
