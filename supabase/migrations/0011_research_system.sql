-- ============================================================================
-- FEEDR Migration 0011: Research System
-- Adds Claude brain + Apify scraping support for smart content research
-- ============================================================================

-- Add research_json column to batches table to store research context
ALTER TABLE batches ADD COLUMN IF NOT EXISTS research_json jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN batches.research_json IS 'Research context from Claude brain analysis + Apify TikTok scraping. Contains: scraped_videos, trend_analysis, search_query, research_summary';

-- Add research as valid job type (if using enum, otherwise jobs table accepts any string)
-- The jobs.type column is text, so no enum update needed

-- Create index for faster queries on batches with research
CREATE INDEX IF NOT EXISTS idx_batches_has_research ON batches ((research_json IS NOT NULL));

-- ============================================================================
-- REQUIRED ENVIRONMENT VARIABLES (set in Supabase dashboard):
-- ============================================================================
-- ANTHROPIC_API_KEY  - Claude API key for brain analysis
-- CLAUDE_MODEL       - Claude model to use (default: claude-3-sonnet-20240229)
-- APIFY_API_TOKEN    - Apify API token for TikTok scraping
-- ============================================================================

-- ============================================================================
-- NEW PIPELINE FLOW:
-- ============================================================================
-- OLD: prompt → compile → tts → video → assemble
-- NEW: prompt → RESEARCH (Claude brain + Apify scrape) → compile → tts → video → assemble
--
-- The research step:
-- 1. Claude analyzes the user prompt to understand intent
-- 2. Claude generates optimal TikTok search query
-- 3. Apify scrapes top-performing TikTok videos for that query
-- 4. Claude analyzes scraped videos for patterns (hooks, structure, engagement drivers)
-- 5. Research context is passed to compile step for better scripts
-- ============================================================================
