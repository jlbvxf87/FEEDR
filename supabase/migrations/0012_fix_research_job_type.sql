-- FEEDR - Fix Research Job Type
-- Migration: 0012_fix_research_job_type.sql
-- 
-- This migration adds 'research' as a valid job type to fix the constraint violation
-- that occurs when generate-batch tries to create a research job.

-- ============================================
-- UPDATE JOBS TABLE JOB TYPE CONSTRAINT
-- ============================================

-- Drop the existing constraint
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_type_check;

-- Add the new constraint that includes 'research'
ALTER TABLE jobs ADD CONSTRAINT jobs_type_check 
  CHECK (type IN ('compile', 'tts', 'video', 'assemble', 'image', 'image_compile', 'research'));

COMMENT ON TABLE jobs IS 'Job queue for processing clips. Types: compile (scripts), tts (voice), video (Sora), assemble (final), image (DALL-E), image_compile (image prompts), research (Claude brain + Apify)';
