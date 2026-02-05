-- FEEDR - Clean Up Test Data
-- ============================
-- Run this to PROPERLY delete test data without resurrection
--
-- THE KEY INSIGHT: Deleting just clips/jobs doesn't work because:
-- 1. The cron runs every 30 seconds
-- 2. Research jobs that are running will create NEW compile jobs
-- 3. Compile jobs will create NEW TTS/video jobs
-- 
-- You MUST delete the BATCH to stop the pipeline completely.

-- ============================================
-- OPTION 1: Stop all running batches (safe)
-- This marks them as failed so jobs stop processing
-- Note: batches table only allows: queued, running, done, failed
-- ============================================

UPDATE batches 
SET status = 'failed'
WHERE status IN ('queued', 'running');

UPDATE jobs 
SET status = 'failed'
WHERE status IN ('queued', 'running');

-- ============================================
-- OPTION 2: Delete ALL test data (nuclear option)
-- WARNING: This deletes everything!
-- ============================================

-- First, cancel any running jobs to prevent race conditions
UPDATE jobs SET status = 'cancelled' WHERE status IN ('queued', 'running');

-- Delete in order (respects foreign key constraints)
-- Jobs deleted via CASCADE when clips/batches are deleted
DELETE FROM service_logs;  -- Clean up logs
DELETE FROM clips;         -- CASCADE deletes jobs with clip_id
DELETE FROM batches;       -- CASCADE deletes remaining jobs

-- ============================================
-- OPTION 3: Delete specific batch by ID
-- Replace 'YOUR-BATCH-ID' with actual UUID
-- ============================================

-- DELETE FROM batches WHERE id = 'YOUR-BATCH-ID';
-- (Jobs and clips cascade delete automatically)

-- ============================================
-- OPTION 4: Delete old batches (older than 24 hours)
-- ============================================

-- DELETE FROM batches WHERE created_at < NOW() - INTERVAL '24 hours';

-- ============================================
-- VERIFY: Check what's left
-- ============================================

SELECT 'batches' as table_name, COUNT(*) as count FROM batches
UNION ALL
SELECT 'clips', COUNT(*) FROM clips
UNION ALL
SELECT 'jobs', COUNT(*) FROM jobs
UNION ALL
SELECT 'jobs (queued)', COUNT(*) FROM jobs WHERE status = 'queued'
UNION ALL
SELECT 'jobs (running)', COUNT(*) FROM jobs WHERE status = 'running';
