// FEEDR - Storage Cleanup Edge Function
// Cleans up:
// 1. Old/killed clips and their files
// 2. Stuck jobs (running > 5 minutes)
// 3. Failed/incomplete batches older than 1 hour
// 4. Orphaned jobs without valid batches

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cleanup thresholds - generous for real API calls
const STUCK_JOB_MINUTES = 20;        // Real APIs can take 10+ minutes
const INCOMPLETE_BATCH_HOURS = 2;    // Give batches 2 hours before marking failed
const FAILED_BATCH_HOURS = 24;

interface ClipForCleanup {
  clip_id: string;
  reason: string;
  voice_url: string | null;
  raw_video_url: string | null;
  final_url: string | null;
  image_url: string | null;
}

interface CleanupResult {
  success: boolean;
  clips_processed: number;
  files_deleted: number;
  stuck_jobs_reset: number;
  failed_jobs_cleaned: number;
  batches_cleaned: number;
  errors: string[];
  duration_ms: number;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const errors: string[] = [];
  let filesDeleted = 0;
  let clipsProcessed = 0;
  let stuckJobsReset = 0;
  let failedJobsCleaned = 0;
  let batchesCleaned = 0;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting cleanup...");

    // ============================================
    // 1. RESET STUCK JOBS (running > 5 minutes)
    // ============================================
    const stuckThreshold = new Date(Date.now() - STUCK_JOB_MINUTES * 60 * 1000).toISOString();
    
    const { data: stuckJobs, error: stuckError } = await supabase
      .from("jobs")
      .update({ 
        status: "queued", 
        error: "Reset: job was stuck",
      })
      .eq("status", "running")
      .lt("updated_at", stuckThreshold)
      .select("id");
    
    if (stuckError) {
      errors.push(`Failed to reset stuck jobs: ${stuckError.message}`);
    } else {
      stuckJobsReset = stuckJobs?.length || 0;
      if (stuckJobsReset > 0) {
        console.log(`Reset ${stuckJobsReset} stuck jobs`);
      }
    }

    // ============================================
    // 2. CLEAN FAILED JOBS (exceeded max retries)
    // ============================================
    const { data: failedJobs, error: failedError } = await supabase
      .from("jobs")
      .delete()
      .eq("status", "failed")
      .select("id, clip_id");
    
    if (failedError) {
      errors.push(`Failed to clean failed jobs: ${failedError.message}`);
    } else {
      failedJobsCleaned = failedJobs?.length || 0;
      
      // Mark associated clips as failed
      const failedClipIds = failedJobs?.filter(j => j.clip_id).map(j => j.clip_id) || [];
      if (failedClipIds.length > 0) {
        await supabase
          .from("clips")
          .update({ status: "failed", error: "Job failed permanently" })
          .in("id", failedClipIds)
          .neq("status", "ready");
      }
      
      if (failedJobsCleaned > 0) {
        console.log(`Cleaned ${failedJobsCleaned} failed jobs`);
      }
    }

    // ============================================
    // 3. CLEAN INCOMPLETE BATCHES (stuck > 1 hour)
    // ============================================
    const incompleteThreshold = new Date(Date.now() - INCOMPLETE_BATCH_HOURS * 60 * 60 * 1000).toISOString();
    
    // Find batches that are still "running" but too old
    const { data: staleBatches } = await supabase
      .from("batches")
      .select("id")
      .eq("status", "running")
      .lt("created_at", incompleteThreshold);
    
    if (staleBatches && staleBatches.length > 0) {
      const staleBatchIds = staleBatches.map(b => b.id);
      
      // Mark stale batches as failed
      await supabase
        .from("batches")
        .update({ status: "failed", error: "Timed out - incomplete after 1 hour" })
        .in("id", staleBatchIds);
      
      // Mark their clips as failed too
      await supabase
        .from("clips")
        .update({ status: "failed", error: "Batch timed out" })
        .in("batch_id", staleBatchIds)
        .neq("status", "ready");
      
      // Delete their pending jobs
      await supabase
        .from("jobs")
        .delete()
        .in("batch_id", staleBatchIds)
        .neq("status", "done");
      
      batchesCleaned += staleBatches.length;
      console.log(`Marked ${staleBatches.length} stale batches as failed`);
    }

    // ============================================
    // 4. DELETE OLD FAILED BATCHES (> 24 hours)
    // ============================================
    const failedThreshold = new Date(Date.now() - FAILED_BATCH_HOURS * 60 * 60 * 1000).toISOString();
    
    // Get failed batches with their clips for file cleanup
    const { data: oldFailedBatches } = await supabase
      .from("batches")
      .select(`
        id,
        clips (
          id,
          voice_url,
          raw_video_url,
          final_url,
          image_url
        )
      `)
      .eq("status", "failed")
      .lt("created_at", failedThreshold);
    
    if (oldFailedBatches && oldFailedBatches.length > 0) {
      for (const batch of oldFailedBatches) {
        // Delete files for each clip
        for (const clip of (batch.clips || [])) {
          const urls = [clip.voice_url, clip.raw_video_url, clip.final_url, clip.image_url].filter(Boolean);
          for (const url of urls) {
            try {
              if (await deleteFileFromUrl(supabase, url!)) {
                filesDeleted++;
              }
            } catch (e) {
              errors.push(`Failed to delete file: ${e}`);
            }
          }
          clipsProcessed++;
        }
      }
      
      // Delete the batches (cascades to clips and jobs)
      const batchIds = oldFailedBatches.map(b => b.id);
      await supabase
        .from("batches")
        .delete()
        .in("id", batchIds);
      
      batchesCleaned += oldFailedBatches.length;
      console.log(`Deleted ${oldFailedBatches.length} old failed batches`);
    }

    // ============================================
    // 5. STANDARD CLIP CLEANUP (killed, old non-winners)
    // ============================================
    try {
      const { data: clipsToClean, error: fetchError } = await supabase
        .rpc("get_clips_for_cleanup");

      if (fetchError) {
        errors.push(`Failed to fetch clips: ${fetchError.message}`);
      } else if (clipsToClean && clipsToClean.length > 0) {
        console.log(`Found ${clipsToClean.length} clips to clean up`);
        
        const clipIds: string[] = [];
        
        for (const clip of clipsToClean as ClipForCleanup[]) {
          clipIds.push(clip.clip_id);
          
          const urlsToDelete = [
            clip.voice_url,
            clip.raw_video_url,
            clip.final_url,
            clip.image_url,
          ].filter(Boolean);

          for (const url of urlsToDelete) {
            try {
              if (await deleteFileFromUrl(supabase, url!)) {
                filesDeleted++;
              }
            } catch (e) {
              errors.push(`Failed to delete ${url}: ${e}`);
            }
          }
        }

        // Mark clips as deleted
        if (clipIds.length > 0) {
          const { data: updateResult, error: updateError } = await supabase
            .rpc("mark_clips_deleted", { clip_ids: clipIds });

          if (updateError) {
            errors.push(`Failed to mark clips deleted: ${updateError.message}`);
          } else {
            clipsProcessed += updateResult || clipIds.length;
          }
        }
      }
    } catch (e) {
      errors.push(`Clip cleanup error: ${e}`);
    }

    // ============================================
    // 6. CLEAN ORPHANED DONE JOBS (older than 1 hour)
    // ============================================
    const doneJobsThreshold = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await supabase
      .from("jobs")
      .delete()
      .eq("status", "done")
      .lt("created_at", doneJobsThreshold);

    // Log the cleanup operation
    await supabase.from("cleanup_log").insert({
      clips_deleted: clipsProcessed,
      files_deleted: filesDeleted,
      bytes_freed: 0,
      details: {
        stuck_jobs_reset: stuckJobsReset,
        failed_jobs_cleaned: failedJobsCleaned,
        batches_cleaned: batchesCleaned,
        errors: errors.slice(0, 10),
      },
    });

    const result: CleanupResult = {
      success: errors.length === 0,
      clips_processed: clipsProcessed,
      files_deleted: filesDeleted,
      stuck_jobs_reset: stuckJobsReset,
      failed_jobs_cleaned: failedJobsCleaned,
      batches_cleaned: batchesCleaned,
      errors: errors.slice(0, 5),
      duration_ms: Date.now() - startTime,
    };

    console.log(`Cleanup complete:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error",
        clips_processed: clipsProcessed,
        files_deleted: filesDeleted,
        stuck_jobs_reset: stuckJobsReset,
        failed_jobs_cleaned: failedJobsCleaned,
        batches_cleaned: batchesCleaned,
        duration_ms: Date.now() - startTime,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Delete a file from Supabase storage given its public URL
 */
async function deleteFileFromUrl(
  supabase: ReturnType<typeof createClient>,
  url: string
): Promise<boolean> {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/storage/v1/object/public/");
    
    if (pathParts.length !== 2) {
      return false;
    }
    
    const [bucket, ...pathSegments] = pathParts[1].split("/");
    const path = pathSegments.join("/");
    
    if (!bucket || !path) {
      return false;
    }
    
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);
    
    if (error) {
      console.error(`Delete failed for ${bucket}/${path}:`, error);
      return false;
    }
    
    return true;
    
  } catch (e) {
    console.error(`Error deleting ${url}:`, e);
    return false;
  }
}
