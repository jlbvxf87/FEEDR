-- ============================================
-- FEEDR IMMEDIATE CLEANUP SCRIPT
-- Run this in Supabase SQL Editor to clean up stuck content
-- ============================================

-- 1. RESET STUCK JOBS (running for more than 5 minutes)
UPDATE jobs 
SET status = 'queued', error = 'Reset: job was stuck'
WHERE status = 'running' 
AND created_at < NOW() - INTERVAL '5 minutes';

-- Show what was reset
SELECT 'Reset stuck jobs:' as action, COUNT(*) as count 
FROM jobs WHERE error = 'Reset: job was stuck';

-- 2. FAIL JOBS WITH TOO MANY ATTEMPTS (> 3 retries)
UPDATE jobs 
SET status = 'failed', error = 'Max retries exceeded'
WHERE status IN ('queued', 'running') 
AND attempts >= 3;

-- 3. MARK CLIPS AS FAILED IF THEIR JOBS FAILED
UPDATE clips c
SET status = 'failed', error = 'Job failed'
FROM jobs j
WHERE j.clip_id = c.id
AND j.status = 'failed'
AND c.status NOT IN ('ready', 'failed');

-- 4. MARK BATCHES AS FAILED IF STUCK > 1 HOUR
UPDATE batches
SET status = 'failed', error = 'Timed out after 1 hour'
WHERE status = 'running'
AND created_at < NOW() - INTERVAL '1 hour';

-- 5. MARK CLIPS IN FAILED BATCHES AS FAILED
UPDATE clips c
SET status = 'failed', error = 'Batch failed'
FROM batches b
WHERE c.batch_id = b.id
AND b.status = 'failed'
AND c.status NOT IN ('ready', 'failed');

-- 6. DELETE ORPHANED JOBS (from failed batches, not done)
DELETE FROM jobs
WHERE status != 'done'
AND batch_id IN (SELECT id FROM batches WHERE status = 'failed');

-- 7. DELETE OLD DONE JOBS (older than 1 hour - no longer needed)
DELETE FROM jobs
WHERE status = 'done'
AND created_at < NOW() - INTERVAL '1 hour';

-- 8. DELETE FAILED JOBS (already processed)
DELETE FROM jobs WHERE status = 'failed';

-- ============================================
-- SUMMARY - Run this to see current state
-- ============================================

SELECT 'Current Database State:' as report;

SELECT 
  'Batches' as table_name,
  COUNT(*) FILTER (WHERE status = 'queued') as queued,
  COUNT(*) FILTER (WHERE status = 'running') as running,
  COUNT(*) FILTER (WHERE status = 'done') as done,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) as total
FROM batches;

SELECT 
  'Clips' as table_name,
  COUNT(*) FILTER (WHERE status = 'planned') as planned,
  COUNT(*) FILTER (WHERE status IN ('scripting', 'vo', 'rendering', 'assembling', 'generating')) as processing,
  COUNT(*) FILTER (WHERE status = 'ready') as ready,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) as total
FROM clips;

SELECT 
  'Jobs' as table_name,
  COUNT(*) FILTER (WHERE status = 'queued') as queued,
  COUNT(*) FILTER (WHERE status = 'running') as running,
  COUNT(*) FILTER (WHERE status = 'done') as done,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) as total
FROM jobs;

-- ============================================
-- OPTIONAL: AGGRESSIVE CLEANUP
-- Uncomment below to DELETE all failed/incomplete content
-- ============================================

-- Delete all failed batches and their clips/jobs (CASCADE)
-- DELETE FROM batches WHERE status = 'failed';

-- Delete all batches that never completed (running > 24 hours)
-- DELETE FROM batches 
-- WHERE status IN ('queued', 'running')
-- AND created_at < NOW() - INTERVAL '24 hours';

-- ============================================
-- OPTIONAL: NUCLEAR OPTION - RESET EVERYTHING
-- Only use if you want to start completely fresh
-- ============================================

-- TRUNCATE jobs CASCADE;
-- TRUNCATE clips CASCADE;
-- TRUNCATE batches CASCADE;
