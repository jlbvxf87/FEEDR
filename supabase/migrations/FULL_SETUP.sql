-- =====================================================================
-- FEEDR COMPLETE DATABASE SETUP
-- Run this entire file in Supabase SQL Editor (one time only)
-- =====================================================================

-- ============================================
-- 0001: CORE TABLES
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PRESETS TABLE
CREATE TABLE IF NOT EXISTS presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  preview_video_url TEXT NULL,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BATCHES TABLE
CREATE TABLE IF NOT EXISTS batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  intent_text TEXT NOT NULL,
  preset_key TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('hook_test', 'angle_test', 'format_test')),
  batch_size INTEGER NOT NULL CHECK (batch_size IN (2, 4, 6, 8)),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  error TEXT NULL,
  -- Billing fields
  user_id UUID REFERENCES auth.users(id),
  quality_mode TEXT DEFAULT 'good',
  base_cost_cents INTEGER DEFAULT 0,
  user_charge_cents INTEGER DEFAULT 0,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'charged', 'failed', 'refunded', 'free'))
);

-- Add updated_at if it doesn't exist (for existing databases)
ALTER TABLE batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_batches_created_at ON batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);

-- CLIPS TABLE
CREATE TABLE IF NOT EXISTS clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL,
  segment_type TEXT NOT NULL DEFAULT 'single',
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'scripting', 'vo', 'rendering', 'assembling', 'generating', 'ready', 'failed')),
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

CREATE INDEX IF NOT EXISTS idx_clips_batch_id ON clips(batch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_clips_batch_variant ON clips(batch_id, variant_id);
CREATE INDEX IF NOT EXISTS idx_clips_status ON clips(status);
CREATE INDEX IF NOT EXISTS idx_clips_winners ON clips(winner) WHERE winner = true;

-- JOBS TABLE
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  clip_id UUID NULL REFERENCES clips(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('compile', 'tts', 'video', 'assemble', 'image', 'image_compile')),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT NULL
);

-- Add updated_at if it doesn't exist (for existing databases)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_jobs_batch_id ON jobs(batch_id);

-- ============================================
-- 0002: ROW LEVEL SECURITY
-- ============================================

ALTER TABLE presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- PRESETS POLICIES
DROP POLICY IF EXISTS "Authenticated users can read presets" ON presets;
CREATE POLICY "Authenticated users can read presets" ON presets FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert presets" ON presets;
CREATE POLICY "Authenticated users can insert presets" ON presets FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update presets" ON presets;
CREATE POLICY "Authenticated users can update presets" ON presets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete presets" ON presets;
CREATE POLICY "Authenticated users can delete presets" ON presets FOR DELETE TO authenticated USING (true);

-- BATCHES POLICIES
DROP POLICY IF EXISTS "Authenticated users can read batches" ON batches;
CREATE POLICY "Authenticated users can read batches" ON batches FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert batches" ON batches;
CREATE POLICY "Authenticated users can insert batches" ON batches FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update batches" ON batches;
CREATE POLICY "Authenticated users can update batches" ON batches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete batches" ON batches;
CREATE POLICY "Authenticated users can delete batches" ON batches FOR DELETE TO authenticated USING (true);

-- CLIPS POLICIES
DROP POLICY IF EXISTS "Authenticated users can read clips" ON clips;
CREATE POLICY "Authenticated users can read clips" ON clips FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert clips" ON clips;
CREATE POLICY "Authenticated users can insert clips" ON clips FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update clips" ON clips;
CREATE POLICY "Authenticated users can update clips" ON clips FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete clips" ON clips;
CREATE POLICY "Authenticated users can delete clips" ON clips FOR DELETE TO authenticated USING (true);

-- JOBS POLICIES
DROP POLICY IF EXISTS "Authenticated users can read jobs" ON jobs;
CREATE POLICY "Authenticated users can read jobs" ON jobs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert jobs" ON jobs;
CREATE POLICY "Authenticated users can insert jobs" ON jobs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update jobs" ON jobs;
CREATE POLICY "Authenticated users can update jobs" ON jobs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete jobs" ON jobs;
CREATE POLICY "Authenticated users can delete jobs" ON jobs FOR DELETE TO authenticated USING (true);

-- ============================================
-- 0003: SEED PRESETS
-- ============================================

INSERT INTO presets (key, name, description, preview_video_url, config_json, is_active) VALUES
('AUTO', 'Auto', 'Best guess based on intent', NULL, '{"auto_select": true, "fallback": "RAW_UGC_V1"}'::jsonb, true),
('RAW_UGC_V1', 'Raw UGC', 'Camera-down, raw captions', NULL, '{"captions": {"enabled": true, "style": "raw_handwritten"}, "fake_comments": {"enabled": false}, "progress_bar": {"enabled": false}, "endcard": {"enabled": false}, "zoom": {"enabled": true, "cadence_sec": 3.0, "min": 1.02, "max": 1.05}}'::jsonb, true),
('TIKTOK_AD_V1', 'TikTok Ad', 'Captions + comments + progress bar + endcard', NULL, '{"captions": {"enabled": true, "style": "bold_lower"}, "fake_comments": {"enabled": true, "variant": "stacked_left"}, "progress_bar": {"enabled": true}, "endcard": {"enabled": true, "duration_sec": 1.2}, "zoom": {"enabled": true, "cadence_sec": 2.5, "min": 1.03, "max": 1.06}}'::jsonb, true),
('PODCAST_V1', 'Podcast', 'Authority clip, clean look', NULL, '{"captions": {"enabled": true, "style": "minimal_center"}, "fake_comments": {"enabled": false}, "progress_bar": {"enabled": false}, "endcard": {"enabled": true, "duration_sec": 1.5}, "zoom": {"enabled": false}}'::jsonb, true),
('SENSORY_V1', 'Sensory', 'Texture/curiosity pacing', NULL, '{"captions": {"enabled": true, "style": "whisper_fade"}, "fake_comments": {"enabled": false}, "progress_bar": {"enabled": false}, "endcard": {"enabled": false}, "zoom": {"enabled": true, "cadence_sec": 1.5, "min": 1.01, "max": 1.08}}'::jsonb, true),
('CLEAN_V1', 'Clean', 'Minimal, no overlays', NULL, '{"captions": {"enabled": false}, "fake_comments": {"enabled": false}, "progress_bar": {"enabled": false}, "endcard": {"enabled": false}, "zoom": {"enabled": false}}'::jsonb, true),
('STORY_V1', 'Story', 'Story-style with progress', NULL, '{"captions": {"enabled": true, "style": "story_top"}, "fake_comments": {"enabled": false}, "progress_bar": {"enabled": true}, "endcard": {"enabled": false}, "zoom": {"enabled": true, "cadence_sec": 2.0, "min": 1.02, "max": 1.04}}'::jsonb, true),
('HOOK_V1', 'Hook Heavy', 'Bold hooks, fast cuts', NULL, '{"captions": {"enabled": true, "style": "bold_shake"}, "fake_comments": {"enabled": true, "variant": "reactions"}, "progress_bar": {"enabled": true}, "endcard": {"enabled": true, "duration_sec": 0.8}, "zoom": {"enabled": true, "cadence_sec": 1.0, "min": 1.05, "max": 1.10}}'::jsonb, true),
('MINIMAL_V1', 'Minimal', 'Subtle captions only', NULL, '{"captions": {"enabled": true, "style": "subtle_bottom"}, "fake_comments": {"enabled": false}, "progress_bar": {"enabled": false}, "endcard": {"enabled": false}, "zoom": {"enabled": true, "cadence_sec": 4.0, "min": 1.01, "max": 1.03}}'::jsonb, true)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, config_json = EXCLUDED.config_json, is_active = EXCLUDED.is_active;

-- ============================================
-- 0004: SERVICE TRACKING
-- ============================================

ALTER TABLE clips ADD COLUMN IF NOT EXISTS script_service TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS voice_service TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS video_service TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS assembly_service TEXT;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS cost_cents INTEGER DEFAULT 0;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_batches_user_id ON batches(user_id, created_at DESC);

-- SERVICE LOGS TABLE
CREATE TABLE IF NOT EXISTS service_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  clip_id UUID REFERENCES clips(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL CHECK (service_type IN ('script', 'voice', 'video', 'assembly', 'research', 'image')),
  service_name TEXT NOT NULL,
  duration_ms INTEGER,
  cost_cents INTEGER DEFAULT 0,
  tokens_used INTEGER,
  error TEXT,
  metadata_json JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_service_logs_batch ON service_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_service_logs_created ON service_logs(created_at DESC);

-- RESEARCH QUERIES TABLE
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

CREATE INDEX IF NOT EXISTS idx_research_user ON research_queries(user_id, created_at DESC);

-- SCRAPED VIDEOS TABLE
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

CREATE INDEX IF NOT EXISTS idx_scraped_videos_research ON scraped_videos(research_id);

-- RLS for new tables
ALTER TABLE service_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to service_logs" ON service_logs;
CREATE POLICY "Service role full access to service_logs" ON service_logs FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access to research_queries" ON research_queries;
CREATE POLICY "Service role full access to research_queries" ON research_queries FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access to scraped_videos" ON scraped_videos;
CREATE POLICY "Service role full access to scraped_videos" ON scraped_videos FOR ALL USING (true);

-- ============================================
-- 0006: IMAGE SUPPORT
-- ============================================

ALTER TABLE batches ADD COLUMN IF NOT EXISTS output_type TEXT DEFAULT 'video' CHECK (output_type IN ('video', 'image'));
ALTER TABLE clips ADD COLUMN IF NOT EXISTS image_type TEXT CHECK (image_type IN ('product', 'lifestyle', 'ad', 'ugc', 'hero', 'custom'));
ALTER TABLE clips ADD COLUMN IF NOT EXISTS image_prompt TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS image_service TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS aspect_ratio TEXT DEFAULT '1:1';

CREATE INDEX IF NOT EXISTS idx_batches_output_type ON batches(output_type);
CREATE INDEX IF NOT EXISTS idx_clips_image_type ON clips(image_type) WHERE image_type IS NOT NULL;

-- IMAGE PRESETS
INSERT INTO presets (key, name, description, config_json, is_active) VALUES
  ('PRODUCT_CLEAN', 'Product Clean', 'Clean product shots on white background', '{"style": "product", "background": "white"}'::jsonb, true),
  ('PRODUCT_LIFESTYLE', 'Product Lifestyle', 'Product in lifestyle context', '{"style": "lifestyle", "background": "natural"}'::jsonb, true),
  ('AD_BOLD', 'Ad Bold', 'Bold advertising style images', '{"style": "ad", "colors": "vibrant"}'::jsonb, true),
  ('UGC_AUTHENTIC', 'UGC Authentic', 'Authentic user-generated style', '{"style": "ugc", "quality": "casual"}'::jsonb, true),
  ('HERO_BANNER', 'Hero Banner', 'Wide hero banner images', '{"style": "hero", "aspect_ratio": "16:9"}'::jsonb, true)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 0007: USER PREFERENCES (for learning)
-- ============================================

ALTER TABLE clips ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_clips_user_id ON clips(user_id);

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  preferred_presets JSONB DEFAULT '{}',
  preferred_tones JSONB DEFAULT '[]',
  preferred_hooks JSONB DEFAULT '[]',
  avg_script_length INTEGER DEFAULT 150,
  default_output_type TEXT DEFAULT 'video',
  default_batch_size INTEGER DEFAULT 3,
  auto_research BOOLEAN DEFAULT true,
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
CREATE POLICY "Users can view own preferences" ON user_preferences FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
CREATE POLICY "Users can update own preferences" ON user_preferences FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
CREATE POLICY "Users can insert own preferences" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role full access preferences" ON user_preferences;
CREATE POLICY "Service role full access preferences" ON user_preferences FOR ALL USING (true);

ALTER TABLE batches ADD COLUMN IF NOT EXISTS winner_clip_id UUID REFERENCES clips(id);

-- ============================================
-- 0008: STORAGE CLEANUP & RETENTION
-- ============================================

-- Storage tracking table
CREATE TABLE IF NOT EXISTS storage_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  bucket TEXT NOT NULL,
  file_count INTEGER NOT NULL DEFAULT 0,
  total_bytes BIGINT NOT NULL DEFAULT 0,
  UNIQUE(recorded_at, bucket)
);

-- Cleanup log table
CREATE TABLE IF NOT EXISTS cleanup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  clips_deleted INTEGER NOT NULL DEFAULT 0,
  files_deleted INTEGER NOT NULL DEFAULT 0,
  bytes_freed BIGINT NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Add retention fields to clips
ALTER TABLE clips 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS storage_bytes BIGINT NULL DEFAULT 0;

-- Retention settings
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

-- Function to get clips for cleanup
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
  SELECT setting_value::INTEGER INTO killed_hours 
  FROM retention_settings WHERE setting_key = 'killed_retention_hours';
  SELECT setting_value::INTEGER INTO non_winner_days 
  FROM retention_settings WHERE setting_key = 'non_winner_retention_days';
  killed_hours := COALESCE(killed_hours, 24);
  non_winner_days := COALESCE(non_winner_days, 30);
  
  RETURN QUERY
  SELECT c.id, 'killed'::TEXT, c.voice_url, c.raw_video_url, c.final_url, c.image_url
  FROM clips c
  WHERE c.killed = true AND c.deleted_at IS NULL
    AND c.created_at < NOW() - (killed_hours || ' hours')::INTERVAL
  UNION ALL
  SELECT c.id, 'expired'::TEXT, c.voice_url, c.raw_video_url, c.final_url, c.image_url
  FROM clips c
  WHERE c.winner = false AND c.killed = false AND c.deleted_at IS NULL
    AND c.created_at < NOW() - (non_winner_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function to mark clips as deleted
CREATE OR REPLACE FUNCTION mark_clips_deleted(clip_ids UUID[])
RETURNS INTEGER AS $$
DECLARE updated_count INTEGER;
BEGIN
  UPDATE clips SET deleted_at = NOW(), voice_url = NULL, raw_video_url = NULL, final_url = NULL, image_url = NULL
  WHERE id = ANY(clip_ids) AND deleted_at IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Storage summary view
CREATE OR REPLACE VIEW storage_summary AS
SELECT 'clips' as type, COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE winner = true) as winners,
  COUNT(*) FILTER (WHERE killed = true) as killed,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND final_url IS NOT NULL) as active_with_files,
  COALESCE(SUM(storage_bytes) FILTER (WHERE deleted_at IS NULL), 0) as active_bytes
FROM clips;

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_clips_cleanup ON clips(killed, winner, deleted_at, created_at) WHERE deleted_at IS NULL;

-- ============================================
-- BILLING SYSTEM (from 0007_billing_system.sql)
-- ============================================

-- USER CREDITS TABLE (pay-as-you-go wallet)
CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  lifetime_added_cents INTEGER NOT NULL DEFAULT 0,
  lifetime_spent_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_credits_user ON user_credits(user_id);

-- CREDIT TRANSACTIONS TABLE (audit trail)
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  balance_after_cents INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'purchase', 'generation', 'refund', 'bonus', 'subscription', 'adjustment'
  )),
  description TEXT,
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  stripe_payment_id TEXT,
  metadata_json JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_tx_batch ON credit_transactions(batch_id);

-- PRICING CONFIG TABLE
CREATE TABLE IF NOT EXISTS pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value_json JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO pricing_config (key, value_json, description) VALUES 
  ('upsell_multiplier', '1.5', 'Multiplier applied to base cost (1.5 = 50% margin)'),
  ('free_credits_signup', '500', 'Free credits given on signup (in cents, e.g., 500 = $5)'),
  ('min_purchase_cents', '500', 'Minimum credit purchase amount (500 = $5)')
ON CONFLICT (key) DO NOTHING;

-- BILLING SUMMARY VIEW
CREATE OR REPLACE VIEW billing_summary AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_batches,
  SUM(base_cost_cents) as total_api_cost_cents,
  SUM(user_charge_cents) as total_revenue_cents,
  SUM(user_charge_cents - base_cost_cents) as total_profit_cents
FROM batches
WHERE status = 'done' AND payment_status = 'charged'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- FUNCTION: Deduct credits
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID,
  p_batch_id UUID,
  p_amount_cents INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  SELECT balance_cents INTO v_current_balance
  FROM user_credits WHERE user_id = p_user_id FOR UPDATE;
  
  IF v_current_balance IS NULL OR v_current_balance < p_amount_cents THEN
    RETURN FALSE;
  END IF;
  
  v_new_balance := v_current_balance - p_amount_cents;
  
  UPDATE user_credits SET 
    balance_cents = v_new_balance,
    lifetime_spent_cents = lifetime_spent_cents + p_amount_cents,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  INSERT INTO credit_transactions (
    user_id, amount_cents, balance_after_cents, 
    transaction_type, batch_id, description
  ) VALUES (
    p_user_id, -p_amount_cents, v_new_balance,
    'generation', p_batch_id, 'Batch generation'
  );
  
  UPDATE batches SET payment_status = 'charged' WHERE id = p_batch_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCTION: Add credits
CREATE OR REPLACE FUNCTION add_credits(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_stripe_payment_id TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  INSERT INTO user_credits (user_id, balance_cents, lifetime_added_cents)
  VALUES (p_user_id, p_amount_cents, p_amount_cents)
  ON CONFLICT (user_id) DO UPDATE SET
    balance_cents = user_credits.balance_cents + p_amount_cents,
    lifetime_added_cents = user_credits.lifetime_added_cents + p_amount_cents,
    updated_at = now()
  RETURNING balance_cents INTO v_new_balance;
  
  INSERT INTO credit_transactions (
    user_id, amount_cents, balance_after_cents,
    transaction_type, description, stripe_payment_id
  ) VALUES (
    p_user_id, p_amount_cents, v_new_balance,
    p_type, p_description, p_stripe_payment_id
  );
  
  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCTION: Refund batch
CREATE OR REPLACE FUNCTION refund_batch(p_batch_id UUID) RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_charge_cents INTEGER;
  v_new_balance INTEGER;
BEGIN
  SELECT user_id, user_charge_cents INTO v_user_id, v_charge_cents
  FROM batches WHERE id = p_batch_id AND payment_status = 'charged';
  
  IF v_user_id IS NULL THEN RETURN FALSE; END IF;
  
  UPDATE user_credits SET balance_cents = balance_cents + v_charge_cents, updated_at = now()
  WHERE user_id = v_user_id RETURNING balance_cents INTO v_new_balance;
  
  INSERT INTO credit_transactions (
    user_id, amount_cents, balance_after_cents,
    transaction_type, batch_id, description
  ) VALUES (v_user_id, v_charge_cents, v_new_balance, 'refund', p_batch_id, 'Refund for failed batch');
  
  UPDATE batches SET payment_status = 'refunded' WHERE id = p_batch_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER: Auto-create credits on signup
CREATE OR REPLACE FUNCTION handle_new_user_credits() RETURNS TRIGGER AS $$
DECLARE v_signup_bonus INTEGER;
BEGIN
  SELECT (value_json::TEXT)::INTEGER INTO v_signup_bonus
  FROM pricing_config WHERE key = 'free_credits_signup';
  v_signup_bonus := COALESCE(v_signup_bonus, 500);
  
  INSERT INTO user_credits (user_id, balance_cents, lifetime_added_cents)
  VALUES (NEW.id, v_signup_bonus, v_signup_bonus);
  
  INSERT INTO credit_transactions (
    user_id, amount_cents, balance_after_cents, transaction_type, description
  ) VALUES (NEW.id, v_signup_bonus, v_signup_bonus, 'bonus', 'Welcome bonus');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_credits();

-- RLS for billing tables
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credits" ON user_credits FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can view own transactions" ON credit_transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Service role full access to user_credits" ON user_credits FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to credit_transactions" ON credit_transactions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated users can read pricing" ON pricing_config FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- ============================================
-- DONE! Your database is ready.
-- ============================================
