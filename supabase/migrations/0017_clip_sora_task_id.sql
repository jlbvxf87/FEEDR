-- Migration 0017: Add sora_task_id to clips table
--
-- Problem: If a video job submits to Sora ($0.50) but the worker crashes before
-- saving the task_id to the job payload, a retry re-submits → double charge.
-- Storing the task_id on the clip record provides a durable recovery point.

ALTER TABLE clips ADD COLUMN IF NOT EXISTS sora_task_id TEXT;

COMMENT ON COLUMN clips.sora_task_id IS
  'KIE.AI/Sora task ID for video generation. Used to prevent duplicate submissions on retry.';
