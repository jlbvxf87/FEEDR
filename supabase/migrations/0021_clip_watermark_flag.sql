-- Track whether watermark removal should be skipped for a clip

ALTER TABLE clips
  ADD COLUMN IF NOT EXISTS watermark_removal_disabled BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_clips_watermark_disabled ON clips(watermark_removal_disabled);
