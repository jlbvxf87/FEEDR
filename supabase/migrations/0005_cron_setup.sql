-- FEEDR - Cron Job Setup
-- Migration: 0005_cron_setup.sql
-- 
-- This sets up pg_cron to automatically trigger the worker function
-- Note: pg_cron must be enabled in Supabase Dashboard > Database > Extensions

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule the worker to run every 30 seconds
-- This calls the cron-worker edge function which processes multiple jobs

-- Remove existing job if it exists
SELECT cron.unschedule('feedr-worker') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'feedr-worker'
);

-- Create new cron job
-- Runs every 30 seconds to process queued jobs
SELECT cron.schedule(
  'feedr-worker',
  '*/30 * * * * *',  -- Every 30 seconds
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/cron-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{"source": "cron"}'::jsonb
    ) AS request_id;
  $$
);

-- Alternative: Using pg_net for HTTP calls (if pg_cron schedule doesn't support HTTP)
-- You may need to set up a database function that the cron job calls

-- Function to trigger the worker via HTTP
CREATE OR REPLACE FUNCTION trigger_feedr_worker()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  service_key text;
BEGIN
  -- Get settings (these need to be set in Supabase Dashboard)
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);
  
  IF supabase_url IS NULL OR service_key IS NULL THEN
    RAISE NOTICE 'Supabase settings not configured for cron worker';
    RETURN;
  END IF;
  
  -- Make HTTP request to worker
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/cron-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{"source": "cron"}'::jsonb
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION trigger_feedr_worker() TO service_role;

COMMENT ON FUNCTION trigger_feedr_worker() IS 'Triggers the FEEDR worker to process queued jobs';
