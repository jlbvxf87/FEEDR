-- FEEDR - OpenClaw Learning Support
-- Migration: 0007_openclaw_learning.sql

-- ============================================
-- ADD USER TRACKING TO CLIPS FOR LEARNING
-- ============================================

-- Add user_id to clips if not exists (for learning which user created what)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clips' AND column_name = 'user_id') THEN
    ALTER TABLE clips ADD COLUMN user_id UUID REFERENCES auth.users(id);
    CREATE INDEX idx_clips_user_id ON clips(user_id);
  END IF;
END $$;

-- Add is_winner column if not exists (alias for winner for OpenClaw)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clips' AND column_name = 'is_winner') THEN
    -- Create alias view or just use winner column
    -- We'll use the existing winner column
    COMMENT ON COLUMN clips.winner IS 'User marked this clip as a winner (used by OpenClaw for learning)';
  END IF;
END $$;

-- ============================================
-- OPENCLAW LEARNING METADATA TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Learned preferences (updated by OpenClaw)
  preferred_presets JSONB DEFAULT '{}',     -- { "VIRAL_HOOK": 5, "PRODUCT": 3 }
  preferred_tones JSONB DEFAULT '[]',       -- ["casual", "funny"]
  preferred_hooks JSONB DEFAULT '[]',       -- ["Did you know...", "Stop scrolling if..."]
  avg_script_length INTEGER DEFAULT 150,
  
  -- User settings
  default_output_type TEXT DEFAULT 'video',
  default_batch_size INTEGER DEFAULT 3,
  auto_research BOOLEAN DEFAULT true,       -- Should OpenClaw auto-research?
  
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);

COMMENT ON TABLE user_preferences IS 'User preferences learned by OpenClaw from winner selections';

-- ============================================
-- FUNCTION TO UPDATE PREFERENCES ON WINNER
-- ============================================

CREATE OR REPLACE FUNCTION update_user_preferences_on_winner()
RETURNS TRIGGER AS $$
DECLARE
  v_preset_key TEXT;
  v_user_id UUID;
  v_current_presets JSONB;
  v_preset_count INTEGER;
BEGIN
  -- Only trigger when winner becomes true
  IF NEW.winner = true AND (OLD.winner = false OR OLD.winner IS NULL) THEN
    
    -- Get user_id and preset from batch
    SELECT b.preset_key, c.user_id INTO v_preset_key, v_user_id
    FROM batches b
    JOIN clips c ON c.batch_id = b.id
    WHERE c.id = NEW.id;
    
    IF v_user_id IS NOT NULL THEN
      -- Ensure user_preferences record exists
      INSERT INTO user_preferences (user_id)
      VALUES (v_user_id)
      ON CONFLICT (user_id) DO NOTHING;
      
      -- Get current preset counts
      SELECT preferred_presets INTO v_current_presets
      FROM user_preferences
      WHERE user_id = v_user_id;
      
      -- Increment count for this preset
      v_preset_count := COALESCE((v_current_presets->>v_preset_key)::INTEGER, 0) + 1;
      
      -- Update preferences
      UPDATE user_preferences
      SET 
        preferred_presets = jsonb_set(
          COALESCE(preferred_presets, '{}'::jsonb),
          ARRAY[v_preset_key],
          to_jsonb(v_preset_count)
        ),
        updated_at = now()
      WHERE user_id = v_user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_preferences_on_winner ON clips;
CREATE TRIGGER trg_update_preferences_on_winner
  AFTER UPDATE OF winner ON clips
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_on_winner();

-- ============================================
-- RLS FOR USER PREFERENCES
-- ============================================

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only see their own preferences
CREATE POLICY "Users can view own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role can do anything (for OpenClaw backend)
CREATE POLICY "Service role full access" ON user_preferences
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- ADD WINNER_CLIP_ID TO BATCHES FOR TRACKING
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'batches' AND column_name = 'winner_clip_id') THEN
    ALTER TABLE batches ADD COLUMN winner_clip_id UUID REFERENCES clips(id);
  END IF;
END $$;
