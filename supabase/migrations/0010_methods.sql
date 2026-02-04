-- FEEDR Enhanced Methods System
-- Migration: 0010_methods.sql
-- Adds creator-familiar content methods alongside existing presets

-- ============================================================================
-- NEW METHOD PRESETS
-- These use creator-familiar names and map to rich method configurations
-- ============================================================================

INSERT INTO presets (key, name, description, preview_video_url, config_json, is_active) VALUES

-- FOUNDERS METHOD - Authority & credibility
('FOUNDERS', 'Founders Method', 'Authority & credibility. "After 10 years building companies..."', NULL, '{
  "method": "FOUNDERS",
  "hook_formula": "Authority statement + personal stake",
  "pacing": "Measured, confident",
  "structure": ["Hook with credibility", "Insight/contrarian take", "Proof point", "Viewer takeaway"],
  "captions": {"enabled": true, "style": "fade", "position": "bottom", "fontSize": 32},
  "fake_comments": {"enabled": false},
  "progress_bar": {"enabled": false},
  "zoom": {"enabled": true, "cadence_sec": 5.0, "min": 1.0, "max": 1.05}
}'::jsonb, true),

-- PODCAST METHOD - Hot takes & opinions
('PODCAST', 'Podcast Method', 'Hot takes & opinions. "Unpopular opinion but..."', NULL, '{
  "method": "PODCAST",
  "hook_formula": "Hot take or opinion that demands response",
  "pacing": "Conversational, natural pauses",
  "structure": ["Bold hot take", "Your reasoning", "Evidence/example", "Challenge to viewer"],
  "captions": {"enabled": true, "style": "pop", "position": "center", "fontSize": 36},
  "fake_comments": {"enabled": false},
  "progress_bar": {"enabled": false},
  "zoom": {"enabled": true, "cadence_sec": 3.0, "min": 1.0, "max": 1.08}
}'::jsonb, true),

-- DISCOVERY METHOD - Curiosity-driven reveals
('DISCOVERY', 'Discovery Method', '"I just found out..." Curiosity-driven reveals.', NULL, '{
  "method": "DISCOVERY",
  "hook_formula": "Curiosity gap - I just found out...",
  "pacing": "Building excitement, start curious end amazed",
  "structure": ["Curiosity hook", "Discovery context", "The reveal", "Why it matters"],
  "captions": {"enabled": true, "style": "typewriter", "position": "center", "fontSize": 38},
  "fake_comments": {"enabled": false},
  "progress_bar": {"enabled": false},
  "zoom": {"enabled": true, "cadence_sec": 2.5, "min": 1.0, "max": 1.12}
}'::jsonb, true),

-- CAMERA PUT DOWN METHOD - Urgent, raw, authentic
('CAMERA_PUT_DOWN', 'Camera Put Down', 'Caught-in-the-moment urgency. Raw and fast.', NULL, '{
  "method": "CAMERA_PUT_DOWN",
  "hook_formula": "Mid-sentence start, already in motion",
  "pacing": "Fast, urgent, no filler",
  "structure": ["Already mid-thought", "The point directly", "Quick proof", "Rapid CTA"],
  "captions": {"enabled": true, "style": "pop", "position": "center", "fontSize": 42},
  "fake_comments": {"enabled": false},
  "progress_bar": {"enabled": false},
  "zoom": {"enabled": true, "cadence_sec": 1.5, "min": 1.0, "max": 1.15}
}'::jsonb, true),

-- SENSORY METHOD - Satisfying & ASMR
('SENSORY', 'Sensory Method', 'Satisfying textures and ASMR vibes.', NULL, '{
  "method": "SENSORY",
  "hook_formula": "Visual intrigue - Watch this...",
  "pacing": "Slow, deliberate, ASMR-like",
  "structure": ["Visual hook", "Slow reveal", "Peak satisfaction", "Soft close"],
  "captions": {"enabled": true, "style": "fade", "position": "bottom", "fontSize": 28},
  "fake_comments": {"enabled": false},
  "progress_bar": {"enabled": false},
  "zoom": {"enabled": true, "cadence_sec": 8.0, "min": 1.0, "max": 1.25}
}'::jsonb, true),

-- DELAYED GRATIFICATION METHOD - Tension & payoff
('DELAYED_GRATIFICATION', 'Delayed Gratification', '"Wait for it..." Tension and payoff.', NULL, '{
  "method": "DELAYED_GRATIFICATION",
  "hook_formula": "Tease the payoff upfront",
  "pacing": "Tension building, each beat raises stakes",
  "structure": ["Tease payoff", "Setup/before state", "Building tension", "The reveal"],
  "captions": {"enabled": true, "style": "typewriter", "position": "center", "fontSize": 36},
  "fake_comments": {"enabled": false},
  "progress_bar": {"enabled": true, "position": "top"},
  "zoom": {"enabled": true, "cadence_sec": 2.0, "min": 1.0, "max": 1.1}
}'::jsonb, true)

ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  config_json = EXCLUDED.config_json,
  is_active = EXCLUDED.is_active;

-- ============================================================================
-- UPDATE AUTO PRESET
-- Now with smart detection that picks the best method from user's prompt
-- ============================================================================

UPDATE presets SET 
  description = 'Smart detection - picks the best method from your prompt',
  config_json = '{
    "auto_select": true,
    "smart_detection": true,
    "fallback": "FOUNDERS"
  }'::jsonb
WHERE key = 'AUTO';

-- ============================================================================
-- DEACTIVATE LEGACY PRESETS (optional - keep for backwards compatibility)
-- Uncomment to hide old presets from UI while keeping them for existing batches
-- ============================================================================

-- UPDATE presets SET is_active = false WHERE key IN (
--   'RAW_UGC_V1', 'TIKTOK_AD_V1', 'SENSORY_V1', 'CLEAN_V1', 'STORY_V1', 'HOOK_V1', 'MINIMAL_V1'
-- );

-- Keep PODCAST_V1 active as it maps to the new PODCAST method
-- UPDATE presets SET is_active = false WHERE key = 'PODCAST_V1';
