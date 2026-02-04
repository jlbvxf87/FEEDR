-- FEEDR - Image Generation Support
-- Migration: 0006_image_support.sql

-- ============================================
-- UPDATE BATCHES TABLE FOR OUTPUT TYPE
-- ============================================
ALTER TABLE batches ADD COLUMN IF NOT EXISTS output_type TEXT NOT NULL DEFAULT 'video' 
  CHECK (output_type IN ('video', 'image'));

COMMENT ON COLUMN batches.output_type IS 'Type of content to generate: video or image';

-- ============================================
-- UPDATE CLIPS TABLE FOR IMAGE SUPPORT
-- ============================================
-- Image-specific fields
ALTER TABLE clips ADD COLUMN IF NOT EXISTS image_type TEXT 
  CHECK (image_type IN ('product', 'lifestyle', 'ad', 'ugc', 'hero', 'custom'));
ALTER TABLE clips ADD COLUMN IF NOT EXISTS image_prompt TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS image_service TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS aspect_ratio TEXT DEFAULT '1:1';

-- Update status to include image states
ALTER TABLE clips DROP CONSTRAINT IF EXISTS clips_status_check;
ALTER TABLE clips ADD CONSTRAINT clips_status_check 
  CHECK (status IN ('planned', 'scripting', 'vo', 'rendering', 'assembling', 'generating', 'ready', 'failed'));

COMMENT ON COLUMN clips.image_type IS 'Type of image: product, lifestyle, ad, ugc, hero, custom';
COMMENT ON COLUMN clips.image_prompt IS 'Prompt used for image generation';
COMMENT ON COLUMN clips.image_url IS 'URL of generated image';
COMMENT ON COLUMN clips.image_service IS 'Service used for image gen (mock, dalle, flux)';
COMMENT ON COLUMN clips.aspect_ratio IS 'Aspect ratio for image/video';

-- ============================================
-- UPDATE JOBS TABLE FOR IMAGE JOBS
-- ============================================
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_type_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_type_check 
  CHECK (type IN ('compile', 'tts', 'video', 'assemble', 'image', 'image_compile'));

-- ============================================
-- ADD IMAGE PRESETS
-- ============================================
-- Insert image-specific presets (they work for both video and images)
INSERT INTO presets (key, name, description, config_json, is_active) VALUES
  ('PRODUCT_CLEAN', 'Product Clean', 'Clean product shots on white background', 
   '{"style": "product", "background": "white", "lighting": "studio"}'::jsonb, true),
  ('PRODUCT_LIFESTYLE', 'Product Lifestyle', 'Product in lifestyle context', 
   '{"style": "lifestyle", "background": "natural", "lighting": "warm"}'::jsonb, true),
  ('AD_BOLD', 'Ad Bold', 'Bold advertising style images', 
   '{"style": "ad", "colors": "vibrant", "composition": "dynamic"}'::jsonb, true),
  ('UGC_AUTHENTIC', 'UGC Authentic', 'Authentic user-generated style', 
   '{"style": "ugc", "quality": "casual", "lighting": "natural"}'::jsonb, true),
  ('HERO_BANNER', 'Hero Banner', 'Wide hero banner images', 
   '{"style": "hero", "aspect_ratio": "16:9", "composition": "wide"}'::jsonb, true)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- INDEX FOR IMAGE QUERIES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_batches_output_type ON batches(output_type);
CREATE INDEX IF NOT EXISTS idx_clips_image_type ON clips(image_type) WHERE image_type IS NOT NULL;
