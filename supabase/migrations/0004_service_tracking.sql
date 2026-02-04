-- FEEDR - Service Tracking & Research Tables
-- Migration: 0004_service_tracking.sql

-- ============================================
-- SERVICE TRACKING ON CLIPS
-- ============================================
-- Track which services were used for each clip
ALTER TABLE clips ADD COLUMN IF NOT EXISTS script_service TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS voice_service TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS video_service TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS assembly_service TEXT;

COMMENT ON COLUMN clips.script_service IS 'Service used for script generation (mock, openai, claude)';
COMMENT ON COLUMN clips.voice_service IS 'Service used for TTS (mock, elevenlabs, openai)';
COMMENT ON COLUMN clips.video_service IS 'Service used for video gen (mock, sora, runway)';
COMMENT ON COLUMN clips.assembly_service IS 'Service used for assembly (mock, ffmpeg)';

-- ============================================
-- COST TRACKING ON BATCHES
-- ============================================
ALTER TABLE batches ADD COLUMN IF NOT EXISTS cost_cents INTEGER DEFAULT 0;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

COMMENT ON COLUMN batches.cost_cents IS 'Total estimated cost in cents for this batch';
COMMENT ON COLUMN batches.user_id IS 'User who created this batch';

-- Index for user batches
CREATE INDEX IF NOT EXISTS idx_batches_user_id ON batches(user_id, created_at DESC);

-- ============================================
-- SERVICE USAGE LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS service_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  clip_id UUID REFERENCES clips(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL CHECK (service_type IN ('script', 'voice', 'video', 'assembly', 'research')),
  service_name TEXT NOT NULL,
  duration_ms INTEGER,
  cost_cents INTEGER DEFAULT 0,
  tokens_used INTEGER,
  error TEXT,
  metadata_json JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE service_logs IS 'Log of all AI service API calls for monitoring and cost tracking';
COMMENT ON COLUMN service_logs.service_type IS 'Type of service: script, voice, video, assembly, research';
COMMENT ON COLUMN service_logs.service_name IS 'Specific service: openai, claude, elevenlabs, sora, etc.';
COMMENT ON COLUMN service_logs.tokens_used IS 'Tokens used for LLM calls';
COMMENT ON COLUMN service_logs.metadata_json IS 'Additional metadata (model, params, etc.)';

CREATE INDEX IF NOT EXISTS idx_service_logs_batch ON service_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_service_logs_created ON service_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_logs_type ON service_logs(service_type, service_name);

-- ============================================
-- RESEARCH QUERIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS research_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'tiktok' CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'all')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scraping', 'analyzing', 'complete', 'failed')),
  videos_found INTEGER DEFAULT 0,
  results_json JSONB,
  analysis_json JSONB,
  error TEXT
);

COMMENT ON TABLE research_queries IS 'User research queries for trend analysis';
COMMENT ON COLUMN research_queries.results_json IS 'Scraped video data';
COMMENT ON COLUMN research_queries.analysis_json IS 'Clawdbot analysis of patterns';

CREATE INDEX IF NOT EXISTS idx_research_user ON research_queries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_status ON research_queries(status);

-- ============================================
-- SCRAPED VIDEOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS scraped_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  research_id UUID REFERENCES research_queries(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube')),
  video_id TEXT NOT NULL,
  video_url TEXT,
  author_username TEXT,
  caption TEXT,
  transcript TEXT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  hashtags TEXT[],
  hook_text TEXT,
  duration_seconds INTEGER,
  UNIQUE(platform, video_id)
);

COMMENT ON TABLE scraped_videos IS 'Individual scraped videos from research queries';
COMMENT ON COLUMN scraped_videos.hook_text IS 'Transcript of first 3 seconds (the hook)';

CREATE INDEX IF NOT EXISTS idx_scraped_videos_research ON scraped_videos(research_id);
CREATE INDEX IF NOT EXISTS idx_scraped_videos_views ON scraped_videos(views DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE service_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_videos ENABLE ROW LEVEL SECURITY;

-- Service logs: Users can view their own batch logs
CREATE POLICY "Users can view own service logs" ON service_logs
  FOR SELECT
  USING (
    batch_id IN (
      SELECT id FROM batches WHERE user_id = auth.uid()
    )
  );

-- Research queries: Users can CRUD their own
CREATE POLICY "Users can view own research" ON research_queries
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own research" ON research_queries
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own research" ON research_queries
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own research" ON research_queries
  FOR DELETE USING (user_id = auth.uid());

-- Scraped videos: Users can view videos from their research
CREATE POLICY "Users can view own scraped videos" ON scraped_videos
  FOR SELECT
  USING (
    research_id IN (
      SELECT id FROM research_queries WHERE user_id = auth.uid()
    )
  );

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role full access to service_logs" ON service_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to research_queries" ON research_queries
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to scraped_videos" ON scraped_videos
  FOR ALL USING (auth.role() = 'service_role');
