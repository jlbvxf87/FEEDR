-- FEEDR Storage Cleanup & Retention
-- Migration: 0008_storage_cleanup.sql

-- ============================================
-- STORAGE TRACKING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS storage_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  bucket TEXT NOT NULL,
  file_count INTEGER NOT NULL DEFAULT 0,
  total_bytes BIGINT NOT NULL DEFAULT 0,
  
  UNIQUE(recorded_at, bucket)
);

COMMENT ON TABLE storage_usage IS 'Daily storage usage tracking per bucket';

-- ============================================
-- CLEANUP LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cleanup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  clips_deleted INTEGER NOT NULL DEFAULT 0,
  files_deleted INTEGER NOT NULL DEFAULT 0,
  bytes_freed BIGINT NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE cleanup_log IS 'Log of automated cleanup operations';

-- ============================================
-- ADD RETENTION FIELDS TO CLIPS
-- ============================================
ALTER TABLE clips 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS storage_bytes BIGINT NULL DEFAULT 0;

COMMENT ON COLUMN clips.deleted_at IS 'Soft delete timestamp - files cleaned up after this';
COMMENT ON COLUMN clips.storage_bytes IS 'Estimated storage used by this clip';

-- ============================================
-- RETENTION POLICY SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS retention_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO retention_settings (setting_key, setting_value, description) VALUES
  ('killed_retention_hours', '24', 'Hours to keep killed clips before deletion'),
  ('non_winner_retention_days', '30', 'Days to keep non-winner clips'),
  ('winner_retention_days', '365', 'Days to keep winner clips'),
  ('max_storage_gb', '10', 'Max storage before aggressive cleanup'),
  ('cleanup_enabled', 'true', 'Enable automatic cleanup')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- FUNCTION: Get clips ready for cleanup
-- ============================================
CREATE OR REPLACE FUNCTION get_clips_for_cleanup()
RETURNS TABLE (
  clip_id UUID,
  reason TEXT,
  voice_url TEXT,
  raw_video_url TEXT,
  final_url TEXT,
  image_url TEXT
) AS $$
DECLARE
  killed_hours INTEGER;
  non_winner_days INTEGER;
BEGIN
  -- Get retention settings
  SELECT setting_value::INTEGER INTO killed_hours 
  FROM retention_settings WHERE setting_key = 'killed_retention_hours';
  
  SELECT setting_value::INTEGER INTO non_winner_days 
  FROM retention_settings WHERE setting_key = 'non_winner_retention_days';
  
  -- Default values if not set
  killed_hours := COALESCE(killed_hours, 24);
  non_winner_days := COALESCE(non_winner_days, 30);
  
  RETURN QUERY
  -- Killed clips older than retention period
  SELECT 
    c.id as clip_id,
    'killed' as reason,
    c.voice_url,
    c.raw_video_url,
    c.final_url,
    c.image_url
  FROM clips c
  WHERE c.killed = true
    AND c.deleted_at IS NULL
    AND c.created_at < NOW() - (killed_hours || ' hours')::INTERVAL
    
  UNION ALL
  
  -- Non-winner clips older than retention period
  SELECT 
    c.id as clip_id,
    'expired' as reason,
    c.voice_url,
    c.raw_video_url,
    c.final_url,
    c.image_url
  FROM clips c
  WHERE c.winner = false
    AND c.killed = false
    AND c.deleted_at IS NULL
    AND c.created_at < NOW() - (non_winner_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Mark clips as deleted (soft delete)
-- ============================================
CREATE OR REPLACE FUNCTION mark_clips_deleted(clip_ids UUID[])
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE clips
  SET deleted_at = NOW(),
      voice_url = NULL,
      raw_video_url = NULL,
      final_url = NULL,
      image_url = NULL
  WHERE id = ANY(clip_ids)
    AND deleted_at IS NULL;
    
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEW: Storage summary
-- ============================================
CREATE OR REPLACE VIEW storage_summary AS
SELECT 
  'clips' as type,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE winner = true) as winners,
  COUNT(*) FILTER (WHERE killed = true) as killed,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND final_url IS NOT NULL) as active_with_files,
  COALESCE(SUM(storage_bytes) FILTER (WHERE deleted_at IS NULL), 0) as active_bytes
FROM clips

UNION ALL

SELECT 
  'batches' as type,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE status = 'done') as winners,
  COUNT(*) FILTER (WHERE status = 'failed') as killed,
  0 as deleted,
  COUNT(*) FILTER (WHERE status = 'done') as active_with_files,
  0 as active_bytes
FROM batches;

-- ============================================
-- INDEX for cleanup queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_clips_cleanup 
ON clips(killed, winner, deleted_at, created_at) 
WHERE deleted_at IS NULL;
