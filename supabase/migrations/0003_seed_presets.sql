-- FEEDR Terminal Preset Seed Data
-- Migration: 0003_seed_presets.sql

INSERT INTO presets (key, name, description, preview_video_url, config_json, is_active) VALUES

-- AUTO - Intelligent preset selection
('AUTO', 'Auto', 'Best guess based on intent', NULL, '{
  "auto_select": true,
  "fallback": "RAW_UGC_V1"
}'::jsonb, true),

-- RAW_UGC_V1 - Raw user-generated content style
('RAW_UGC_V1', 'Raw UGC', 'Camera-down, raw captions', NULL, '{
  "captions": {"enabled": true, "style": "raw_handwritten"},
  "fake_comments": {"enabled": false},
  "progress_bar": {"enabled": false},
  "endcard": {"enabled": false},
  "zoom": {"enabled": true, "cadence_sec": 3.0, "min": 1.02, "max": 1.05}
}'::jsonb, true),

-- TIKTOK_AD_V1 - TikTok ad format
('TIKTOK_AD_V1', 'TikTok Ad', 'Captions + comments + progress bar + endcard', NULL, '{
  "captions": {"enabled": true, "style": "bold_lower"},
  "fake_comments": {"enabled": true, "variant": "stacked_left"},
  "progress_bar": {"enabled": true},
  "endcard": {"enabled": true, "duration_sec": 1.2},
  "zoom": {"enabled": true, "cadence_sec": 2.5, "min": 1.03, "max": 1.06}
}'::jsonb, true),

-- PODCAST_V1 - Authority/podcast style
('PODCAST_V1', 'Podcast', 'Authority clip, clean look', NULL, '{
  "captions": {"enabled": true, "style": "minimal_center"},
  "fake_comments": {"enabled": false},
  "progress_bar": {"enabled": false},
  "endcard": {"enabled": true, "duration_sec": 1.5},
  "zoom": {"enabled": false}
}'::jsonb, true),

-- SENSORY_V1 - Texture/curiosity pacing
('SENSORY_V1', 'Sensory', 'Texture/curiosity pacing', NULL, '{
  "captions": {"enabled": true, "style": "whisper_fade"},
  "fake_comments": {"enabled": false},
  "progress_bar": {"enabled": false},
  "endcard": {"enabled": false},
  "zoom": {"enabled": true, "cadence_sec": 1.5, "min": 1.01, "max": 1.08}
}'::jsonb, true),

-- CLEAN_V1 - Minimal clean style
('CLEAN_V1', 'Clean', 'Minimal, no overlays', NULL, '{
  "captions": {"enabled": false},
  "fake_comments": {"enabled": false},
  "progress_bar": {"enabled": false},
  "endcard": {"enabled": false},
  "zoom": {"enabled": false}
}'::jsonb, true),

-- STORY_V1 - Story format
('STORY_V1', 'Story', 'Story-style with progress', NULL, '{
  "captions": {"enabled": true, "style": "story_top"},
  "fake_comments": {"enabled": false},
  "progress_bar": {"enabled": true},
  "endcard": {"enabled": false},
  "zoom": {"enabled": true, "cadence_sec": 2.0, "min": 1.02, "max": 1.04}
}'::jsonb, true),

-- HOOK_V1 - Hook-focused format
('HOOK_V1', 'Hook Heavy', 'Bold hooks, fast cuts', NULL, '{
  "captions": {"enabled": true, "style": "bold_shake"},
  "fake_comments": {"enabled": true, "variant": "reactions"},
  "progress_bar": {"enabled": true},
  "endcard": {"enabled": true, "duration_sec": 0.8},
  "zoom": {"enabled": true, "cadence_sec": 1.0, "min": 1.05, "max": 1.10}
}'::jsonb, true),

-- MINIMAL_V1 - Subtle minimal style
('MINIMAL_V1', 'Minimal', 'Subtle captions only', NULL, '{
  "captions": {"enabled": true, "style": "subtle_bottom"},
  "fake_comments": {"enabled": false},
  "progress_bar": {"enabled": false},
  "endcard": {"enabled": false},
  "zoom": {"enabled": true, "cadence_sec": 4.0, "min": 1.01, "max": 1.03}
}'::jsonb, true)

ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  config_json = EXCLUDED.config_json,
  is_active = EXCLUDED.is_active;
