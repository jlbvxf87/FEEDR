-- FEEDR Terminal Database Schema
-- Migration: 0001_init.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PRESETS TABLE
-- ============================================
CREATE TABLE presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  preview_video_url TEXT NULL,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE presets IS 'Preset styles/vibes for video generation';
COMMENT ON COLUMN presets.key IS 'Unique identifier like AUTO, RAW_UGC_V1, TIKTOK_AD_V1';
COMMENT ON COLUMN presets.config_json IS 'Overlay rules: captions style, fake comments, zoom, etc.';

-- ============================================
-- BATCHES TABLE
-- ============================================
CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  intent_text TEXT NOT NULL,
  preset_key TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('hook_test', 'angle_test', 'format_test')),
  batch_size INTEGER NOT NULL CHECK (batch_size IN (2, 4, 6, 8)),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  error TEXT NULL
);

COMMENT ON TABLE batches IS 'A batch of clips generated from a single intent';
COMMENT ON COLUMN batches.intent_text IS 'User input describing what they want to make work';
COMMENT ON COLUMN batches.preset_key IS 'Selected preset or AUTO for automatic selection';
COMMENT ON COLUMN batches.mode IS 'Test type: hook_test, angle_test, or format_test';

CREATE INDEX idx_batches_created_at ON batches(created_at DESC);
CREATE INDEX idx_batches_status ON batches(status);

-- ============================================
-- CLIPS TABLE
-- ============================================
CREATE TABLE clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL,
  segment_type TEXT NOT NULL DEFAULT 'single',
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'scripting', 'vo', 'rendering', 'assembling', 'ready', 'failed')),
  script_spoken TEXT NULL,
  on_screen_text_json JSONB NULL,
  sora_prompt TEXT NULL,
  voice_url TEXT NULL,
  raw_video_url TEXT NULL,
  final_url TEXT NULL,
  preset_key TEXT NOT NULL,
  winner BOOLEAN NOT NULL DEFAULT false,
  killed BOOLEAN NOT NULL DEFAULT false,
  error TEXT NULL
);

COMMENT ON TABLE clips IS 'Individual video clips within a batch';
COMMENT ON COLUMN clips.variant_id IS 'Identifier like V01, V02, etc.';
COMMENT ON COLUMN clips.segment_type IS 'Clip segment type - single for now';
COMMENT ON COLUMN clips.on_screen_text_json IS 'Array of {t: timestamp, text: string} objects';
COMMENT ON COLUMN clips.winner IS 'User marked this clip as a winner';
COMMENT ON COLUMN clips.killed IS 'User marked this clip as killed/rejected';

CREATE INDEX idx_clips_batch_id ON clips(batch_id, created_at);
CREATE INDEX idx_clips_batch_variant ON clips(batch_id, variant_id);
CREATE INDEX idx_clips_status ON clips(status);
CREATE INDEX idx_clips_winners ON clips(winner) WHERE winner = true;

-- ============================================
-- JOBS TABLE (Simple Queue)
-- ============================================
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  clip_id UUID NULL REFERENCES clips(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('compile', 'tts', 'video', 'assemble')),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT NULL
);

COMMENT ON TABLE jobs IS 'Job queue for processing clips';
COMMENT ON COLUMN jobs.type IS 'Job type: compile, tts, video, assemble';

CREATE INDEX idx_jobs_status_created ON jobs(status, created_at) WHERE status = 'queued';
CREATE INDEX idx_jobs_batch_id ON jobs(batch_id);

-- ============================================
-- STORAGE BUCKETS (run via Supabase dashboard or API)
-- ============================================
-- These need to be created via Supabase dashboard:
-- - assets (for logos, endcards, overlays)
-- - voice (for mp3 voice files)
-- - raw (for raw mp4 videos)
-- - final (for final assembled mp4 videos)
-- - previews (for preset preview videos)
