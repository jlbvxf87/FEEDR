// FEEDR Terminal - Worker Edge Function
// POST /functions/v1/worker (body: { action: "run-once" })
//
// Uses atomic job claiming to prevent race conditions when multiple workers run concurrently.
// All child job creation is idempotent to handle retries safely.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { getServices } from "../_shared/services/index.ts";
import { PRESET_OVERLAY_CONFIGS } from "../_shared/services/assembly/interface.ts";
import type { TrendAnalysis, ScrapedVideo, ContentCategory } from "../_shared/services/research/interface.ts";
import { detectCategory, CATEGORY_DETECTION, getViralThreshold } from "../_shared/services/research/interface.ts";
import { VIDEO_DURATION, SCRIPT_CONSTRAINTS } from "../_shared/timing.ts";
import { 
  classifyError, 
  preFlightVideoCheck, 
  validateSoraPrompt, 
  enhanceSoraPrompt,
  validateVariationDiversity,
  estimateBatchCost,
} from "../_shared/quality.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configuration
const MAX_RETRIES = 3;
const JOB_TIMEOUT_MS = 55000; // 55 seconds max per job
const HEARTBEAT_INTERVAL_MS = 30000; // Update heartbeat every 30 seconds for long jobs

// Timeout wrapper for async operations
async function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]);
}

// Helper to create child jobs idempotently
// IMPORTANT: Validates that batch/clip still exist before creating jobs
async function createChildJobIfNotExists(
  supabase: any,
  batchId: string,
  clipId: string | null,
  type: string,
  payload: any
): Promise<string | null> {
  // VALIDATION: Check batch still exists and is not cancelled/deleted
  const { data: batch, error: batchError } = await supabase
    .from("batches")
    .select("id, status")
    .eq("id", batchId)
    .single();
  
  if (batchError || !batch) {
    console.warn(`[createChildJob] Batch ${batchId} no longer exists, skipping ${type} job`);
    return null;
  }
  
  // Skip if batch was cancelled or already failed
  if (batch.status === "cancelled" || batch.status === "failed") {
    console.warn(`[createChildJob] Batch ${batchId} is ${batch.status}, skipping ${type} job`);
    return null;
  }
  
  // VALIDATION: If clip is specified, verify it still exists
  if (clipId) {
    const { data: clip, error: clipError } = await supabase
      .from("clips")
      .select("id")
      .eq("id", clipId)
      .single();
    
    if (clipError || !clip) {
      console.warn(`[createChildJob] Clip ${clipId} no longer exists, skipping ${type} job`);
      return null;
    }
  }
  
  const { data, error } = await supabase.rpc("create_child_job_if_not_exists", {
    p_batch_id: batchId,
    p_clip_id: clipId,
    p_type: type,
    p_payload: payload,
  });
  
  if (error) {
    console.error(`Failed to create ${type} job via RPC:`, error.message);
    // Fallback to direct insert if RPC not available (backwards compatibility)
    // But now with explicit ON CONFLICT handling to prevent duplicates
    const { data: inserted, error: insertError } = await supabase
      .from("jobs")
      .insert({
        batch_id: batchId,
        clip_id: clipId,
        type,
        status: "queued",
        payload_json: payload,
      })
      .select("id")
      .single();
    
    if (insertError) {
      // If it's a duplicate constraint violation, that's fine - job already exists
      if (insertError.code === "23505") {
        console.log(`[createChildJob] ${type} job already exists for clip ${clipId}`);
        return null;
      }
      throw insertError;
    }
    return inserted?.id;
  }
  
  return data;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let heartbeatInterval: number | null = null;
  let jobId: string | null = null;

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get services
    const services = getServices();
    const serviceConfig = services.getServiceConfig();
    console.log("Worker using services:", serviceConfig);

    // ATOMIC JOB CLAIM: Use RPC to claim job with FOR UPDATE SKIP LOCKED
    // This prevents race conditions when multiple workers run concurrently
    const { data: claimedJobs, error: claimError } = await supabase.rpc("claim_next_job");
    
    // Fallback to legacy method if RPC not available
    let job: any = null;
    if (claimError) {
      console.warn("claim_next_job RPC not available, using legacy method:", claimError.message);
      
      // Legacy: SELECT + UPDATE (has race condition, but works without migration)
      const { data: legacyJob, error: jobError } = await supabase
        .from("jobs")
        .select("*")
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      
      if (jobError && jobError.code !== "PGRST116") {
        throw new Error(`Failed to fetch job: ${jobError.message}`);
      }
      
      if (legacyJob) {
        // Mark as running (race condition window here in legacy mode)
        await supabase
          .from("jobs")
          .update({ 
            status: "running", 
            attempts: legacyJob.attempts + 1,
            updated_at: new Date().toISOString()
          })
          .eq("id", legacyJob.id);
        
        job = { ...legacyJob, attempts: legacyJob.attempts + 1 };
      }
    } else if (claimedJobs && claimedJobs.length > 0) {
      // Map RPC result to job object
      const claimed = claimedJobs[0];
      job = {
        id: claimed.job_id,
        type: claimed.job_type,
        batch_id: claimed.job_batch_id,
        clip_id: claimed.job_clip_id,
        payload_json: claimed.job_payload,
        attempts: claimed.job_attempts,
        error: claimed.job_error,
      };
    }

    if (!job) {
      return new Response(
        JSON.stringify({ processed: false, message: "No queued jobs" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    jobId = job.id;

    // Check if this is a video polling job (has sora_task_id in payload)
    // Polling re-queues are NOT retries — they're intentional async continuations
    const isVideoPolling = job.type === "video" && job.payload_json?.sora_task_id;

    // Check if job has exceeded max retries (RPC already incremented attempts)
    // Video polling jobs are exempt — they re-queue intentionally, not due to errors
    if (job.attempts > MAX_RETRIES && !isVideoPolling) {
      await supabase.rpc("complete_job", {
        p_job_id: job.id,
        p_status: "failed",
        p_error: `Max retries (${MAX_RETRIES}) exceeded`,
      }).catch(() => {
        // Fallback if RPC not available
        return supabase
          .from("jobs")
          .update({ status: "failed", error: `Max retries (${MAX_RETRIES}) exceeded` })
          .eq("id", job.id);
      });
      
      // Mark associated clip as failed
      if (job.clip_id) {
        await supabase.from("clips").update({ status: "failed", error: "Job failed after max retries" }).eq("id", job.clip_id);
      }
      
      return new Response(
        JSON.stringify({ processed: false, message: "Job exceeded max retries", job_id: job.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Start heartbeat for long-running jobs to prevent stuck job detection
    heartbeatInterval = setInterval(async () => {
      try {
        await supabase.rpc("job_heartbeat", { p_job_id: job.id }).catch(() => {
          // Fallback if RPC not available
          return supabase
            .from("jobs")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", job.id);
        });
      } catch (e) {
        console.warn("Heartbeat failed:", e);
      }
    }, HEARTBEAT_INTERVAL_MS);

    // Process job based on type
    try {
      const startTime = Date.now();
      
      // Wrap job execution in timeout
      await withTimeout(
        (async () => {
          switch (job.type) {
            case "research":
              await handleResearchJob(supabase, job, services);
              break;
            case "compile":
              await handleCompileJob(supabase, job, services);
              break;
            case "tts":
              await handleTtsJob(supabase, job, services);
              break;
            case "video":
              await handleVideoJob(supabase, job, services);
              break;
            case "assemble":
              await handleAssembleJob(supabase, job, services);
              break;
            case "image_compile":
              await handleImageCompileJob(supabase, job, services);
              break;
            case "image":
              await handleImageJob(supabase, job, services);
              break;
            default:
              throw new Error(`Unknown job type: ${job.type}`);
          }
        })(),
        JOB_TIMEOUT_MS,
        `Job ${job.type}`
      );

      const duration = Date.now() - startTime;

      // Stop heartbeat
      if (heartbeatInterval) clearInterval(heartbeatInterval);

      // Log service usage
      await supabase.from("service_logs").insert({
        batch_id: job.batch_id,
        clip_id: job.clip_id,
        service_type: job.type === "compile" ? "script" : job.type,
        service_name: serviceConfig[job.type === "compile" ? "script" : job.type as keyof typeof serviceConfig] || "unknown",
        duration_ms: duration,
      });

      // Mark job as done using RPC (with fallback)
      await supabase.rpc("complete_job", {
        p_job_id: job.id,
        p_status: "done",
        p_error: null,
      }).catch(() => {
        return supabase
          .from("jobs")
          .update({ status: "done", updated_at: new Date().toISOString() })
          .eq("id", job.id);
      });

      // Check if batch is complete
      await checkBatchCompletion(supabase, job.batch_id);

      return new Response(
        JSON.stringify({ processed: true, job_id: job.id, job_type: job.type, duration_ms: duration }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (jobError: any) {
      // Stop heartbeat on error
      if (heartbeatInterval) clearInterval(heartbeatInterval);

      // VIDEO POLLING SIGNAL: Job was re-queued for async polling, not a real error
      if (jobError?.__videoPolling) {
        console.log(`[Video] Job ${job.id} re-queued for async polling (not an error)`);
        return new Response(
          JSON.stringify({ processed: true, job_id: job.id, job_type: job.type, polling: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.error(`Job ${job.id} error:`, jobError.message);

      // SMART RETRY: Classify error to determine if we should retry
      const errorClassification = classifyError(jobError);
      console.log(`[Error] Type: ${errorClassification.type}, Should retry: ${errorClassification.shouldRetry}`);
      console.log(`[Error] Suggested action: ${errorClassification.suggestedAction}`);
      
      // Determine if we should retry:
      // 1. Error must be retryable (not policy violation, not budget issue)
      // 2. We must have retries remaining
      const canRetry = errorClassification.shouldRetry && job.attempts < MAX_RETRIES;
      
      if (canRetry) {
        // Put back in queue for retry
        const retryMessage = `[${errorClassification.type}] Attempt ${job.attempts} failed: ${jobError.message}`;
        await supabase.rpc("complete_job", {
          p_job_id: job.id,
          p_status: "queued",
          p_error: retryMessage,
        }).catch(() => {
          return supabase
            .from("jobs")
            .update({ 
              status: "queued", 
              error: retryMessage,
              updated_at: new Date().toISOString()
            })
            .eq("id", job.id);
        });
        console.log(`[Retry] Job ${job.id} queued for retry (attempt ${job.attempts + 1})`);
      } else {
        // Mark as permanently failed - no more retries
        const failReason = errorClassification.shouldRetry 
          ? `Max retries exceeded: ${jobError.message}`
          : `[${errorClassification.type}] ${errorClassification.suggestedAction}: ${jobError.message}`;
          
        await supabase.rpc("complete_job", {
          p_job_id: job.id,
          p_status: "failed",
          p_error: failReason,
        }).catch(() => {
          return supabase
            .from("jobs")
            .update({ 
              status: "failed", 
              error: failReason,
              updated_at: new Date().toISOString()
            })
            .eq("id", job.id);
        });
        
        // Mark clip as failed with actionable message
        if (job.clip_id) {
          await supabase.from("clips").update({ 
            status: "failed", 
            error: failReason 
          }).eq("id", job.clip_id);
        }
        
        console.log(`[Failed] Job ${job.id} permanently failed: ${failReason}`);
      }
      
      // Log the error
      await supabase.from("service_logs").insert({
        batch_id: job.batch_id,
        clip_id: job.clip_id,
        service_type: job.type,
        service_name: "error",
        error: jobError.message,
      });

      // Return actual error status (not 200!) so the caller knows something failed
      return new Response(
        JSON.stringify({ 
          processed: false, 
          error: jobError.message, 
          job_id: job.id,
          will_retry: canRetry  // Fixed: was using undefined `shouldRetry`
        }),
        { status: canRetry ? 202 : 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    // Stop heartbeat on fatal error
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    
    console.error("Error in worker:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Handle compile job - generates scripts for all clips using AI service
// NOW ENHANCED with research context from the research job
async function handleCompileJob(supabase: any, job: any, services: ReturnType<typeof getServices>) {
  const { intent_text, preset_key, mode, research_context } = job.payload_json;
  const scriptService = services.getScriptService();
  
  // ═══════════════════════════════════════════════════════════════
  // VALIDATION: Verify batch is still valid before processing
  // Prevents zombie jobs from running on deleted/cancelled batches
  // ═══════════════════════════════════════════════════════════════
  const { data: batchInfo, error: batchError } = await supabase
    .from("batches")
    .select("batch_size, status")
    .eq("id", job.batch_id)
    .single();
  
  if (batchError || !batchInfo) {
    throw new Error(`Batch ${job.batch_id} no longer exists - skipping compile`);
  }
  
  if (batchInfo.status === "cancelled" || batchInfo.status === "failed") {
    console.log(`[Compile] Batch ${job.batch_id} is ${batchInfo.status}, skipping`);
    return; // Exit cleanly without creating child jobs
  }
    
  const batchSize = batchInfo?.batch_size || 4;
  const costEstimate = estimateBatchCost({
    batchSize,
    outputType: "video",
    withResearch: !!research_context,
  });
  
  console.log(`[Compile] ═══════════════════════════════════════════`);
  console.log(`[Compile] Batch size: ${batchSize} variations`);
  console.log(`[Compile] Estimated total cost: $${costEstimate.total.toFixed(2)}`);
  console.log(`[Compile] Breakdown: ${JSON.stringify(costEstimate.breakdown)}`);
  console.log(`[Compile] ═══════════════════════════════════════════`);
  
  // Log if we have research context
  if (research_context?.research_summary) {
    console.log(`[Compile] Using research context with ${research_context.scraped_videos?.length || 0} viral examples`);
  }
  
  // Get all clips for this batch
  const { data: clips, error } = await supabase
    .from("clips")
    .select("*")
    .eq("batch_id", job.batch_id)
    .order("variant_id");

  if (error) throw error;
  if (!clips || clips.length === 0) throw new Error("No clips found for batch");

  // Track generated scripts for diversity check
  const generatedScripts: string[] = [];

  // Process each clip
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    
    // IDEMPOTENCY: Skip clips that already have scripts (from previous partial run)
    if (clip.script_spoken && clip.status !== "planned") {
      console.log(`Clip ${clip.id} already has script, skipping generation`);
      generatedScripts.push(clip.script_spoken);
      // Still ensure TTS job exists
      await createChildJobIfNotExists(supabase, job.batch_id, clip.id, "tts", { 
        script: clip.script_spoken 
      });
      continue;
    }
    
    // Update status to scripting
    await supabase
      .from("clips")
      .update({ status: "scripting" })
      .eq("id", clip.id);
    
    // Generate script using AI service with timeout
    // Include research context if available from research job
    const scriptOutput = await withTimeout(
      scriptService.generateScript({
        intent_text,
        preset_key,
        mode,
        variant_index: i,
        batch_size: clips.length,
        research_context: research_context || undefined,
      }),
      30000, // 30s timeout for script generation
      "Script generation"
    );
    
    const { script_spoken, on_screen_text_json, sora_prompt } = scriptOutput;
    
    // Track for diversity check
    generatedScripts.push(script_spoken);
    
    // Update clip with script data and track service used
    await supabase
      .from("clips")
      .update({
        script_spoken,
        on_screen_text_json,
        sora_prompt,
        status: "planned",
        script_service: scriptService.name,
      })
      .eq("id", clip.id);
    
    // IDEMPOTENT: Create TTS job only if it doesn't already exist
    await createChildJobIfNotExists(supabase, job.batch_id, clip.id, "tts", { 
      script: script_spoken 
    });
  }
  
  // ═══════════════════════════════════════════════════════════════
  // A/B TEST QUALITY: Validate script diversity
  // Ensures we're not wasting money on near-duplicate variations
  // ═══════════════════════════════════════════════════════════════
  if (generatedScripts.length > 1) {
    const diversityCheck = validateVariationDiversity(generatedScripts);
    console.log(`[Compile] Variation diversity score: ${diversityCheck.diversityScore}/100`);
    
    if (!diversityCheck.isValid) {
      console.warn(`[Compile] ⚠️ Low diversity warning: ${diversityCheck.issues.join(", ")}`);
      console.warn(`[Compile] A/B test may not produce meaningful insights`);
      // Don't block - but log for monitoring. Future: could trigger regeneration
    } else {
      console.log(`[Compile] ✓ Good variation diversity for A/B testing`);
    }
  }
}

// Handle TTS job - generates voice audio using AI service
async function handleTtsJob(supabase: any, job: any, services: ReturnType<typeof getServices>) {
  const voiceService = services.getVoiceService();
  
  // Get clip details
  const { data: clip, error: clipError } = await supabase
    .from("clips")
    .select("script_spoken, voice_url")
    .eq("id", job.clip_id)
    .single();
  
  if (clipError) throw clipError;
  if (!clip?.script_spoken) throw new Error("No script found for clip");
  
  // IDEMPOTENCY: Skip if voice already generated (from previous partial run)
  let voice_url = clip.voice_url;
  let duration_seconds = 15; // Default duration
  
  if (!voice_url) {
    // Update clip status to vo
    await supabase
      .from("clips")
      .update({ status: "vo" })
      .eq("id", job.clip_id);
    
    // Generate voice using AI service
    const result = await withTimeout(
      voiceService.generateVoice({
        script: clip.script_spoken,
        clip_id: job.clip_id,
      }),
      30000,
      "Voice generation"
    );
    
    voice_url = result.voice_url;
    duration_seconds = result.duration_seconds;
    
    // Update clip with voice URL
    await supabase
      .from("clips")
      .update({ 
        voice_url,
        voice_service: voiceService.name,
      })
      .eq("id", job.clip_id);
  } else {
    console.log(`Clip ${job.clip_id} already has voice, skipping generation`);
  }
  
  // IDEMPOTENT: Create video job only if it doesn't already exist
  await createChildJobIfNotExists(supabase, job.batch_id, job.clip_id, "video", { 
    duration_seconds 
  });
}

// Handle video job - generates raw video using AI service
// Uses async submit+poll pattern: submits to Sora, re-queues job, polls on next invocation
async function handleVideoJob(supabase: any, job: any, services: ReturnType<typeof getServices>) {
  const videoService = services.getVideoService();

  // Get clip details including script for quality check
  const { data: clip, error: clipError } = await supabase
    .from("clips")
    .select("sora_prompt, raw_video_url, script_spoken, preset_key")
    .eq("id", job.clip_id)
    .single();

  if (clipError) throw clipError;
  if (!clip?.sora_prompt) throw new Error("No video prompt found for clip");

  // IDEMPOTENCY: Skip if video already generated (from previous partial run)
  let raw_video_url = clip.raw_video_url;
  let duration_seconds = job.payload_json?.duration_seconds || 15;

  if (raw_video_url) {
    console.log(`Clip ${job.clip_id} already has raw video, skipping generation`);
    // IDEMPOTENT: Create assemble job only if it doesn't already exist
    await createChildJobIfNotExists(supabase, job.batch_id, job.clip_id, "assemble", {
      duration_seconds
    });
    return;
  }

  // Check if we already have a task_id from a previous submit (Phase 2: Poll)
  const existingTaskId = job.payload_json?.sora_task_id;

  if (existingTaskId) {
    // ═══════════════════════════════════════════════════════════════
    // PHASE 2: POLL — Check status of previously submitted Sora task
    // ═══════════════════════════════════════════════════════════════
    console.log(`[Video Poll] Checking Sora task ${existingTaskId} for clip ${job.clip_id}`);

    if (!videoService.checkStatus) {
      throw new Error("Video service does not support checkStatus");
    }

    const statusResult = await videoService.checkStatus(existingTaskId);
    console.log(`[Video Poll] Task ${existingTaskId} status: ${statusResult.status}`);

    if (statusResult.status === "completed") {
      // Video is ready — download and upload to storage
      const videoUrl = statusResult.result?.raw_video_url;
      if (!videoUrl) {
        throw new Error(`Sora task completed but no video URL returned`);
      }

      console.log(`[Video Poll] Sora video ready, downloading...`);

      let uploadResult;
      if (videoService.downloadAndUploadVideo) {
        uploadResult = await videoService.downloadAndUploadVideo(videoUrl, job.clip_id);
      } else {
        // Fallback: just use the URL directly
        uploadResult = { raw_video_url: videoUrl, duration_seconds };
      }

      raw_video_url = uploadResult.raw_video_url;
      duration_seconds = uploadResult.duration_seconds || duration_seconds;

      // Update clip with video URL
      await supabase
        .from("clips")
        .update({
          raw_video_url,
          video_service: videoService.name,
        })
        .eq("id", job.clip_id);

      console.log(`[Video Poll] Video saved for clip ${job.clip_id}`);

      // Create assemble job
      await createChildJobIfNotExists(supabase, job.batch_id, job.clip_id, "assemble", {
        duration_seconds
      });
      return; // Done! Job will be marked "done" by the outer handler
    }

    if (statusResult.status === "failed") {
      throw new Error(`Sora generation failed: ${statusResult.error || "Unknown error"}`);
    }

    // Still processing or pending — re-queue job to poll again next cycle
    console.log(`[Video Poll] Task still ${statusResult.status}, re-queuing for next poll...`);

    await supabase.rpc("complete_job", {
      p_job_id: job.id,
      p_status: "queued",
      p_error: null,
      p_payload: null,
      p_reset_attempts: true,
    }).catch(() => {
      return supabase
        .from("jobs")
        .update({
          status: "queued",
          attempts: 0,
          updated_at: new Date().toISOString()
        })
        .eq("id", job.id);
    });

    // Throw special signal so the outer handler doesn't mark as "done"
    const pollingSignal: any = new Error("__videoPolling");
    pollingSignal.__videoPolling = true;
    throw pollingSignal;

  } else {
    // ═══════════════════════════════════════════════════════════════
    // PHASE 1: SUBMIT — Validate prompt and submit to Sora
    // ═══════════════════════════════════════════════════════════════
    console.log(`[Video Submit] Starting video generation for clip ${job.clip_id}`);

    // Quality gate: pre-flight check before expensive Sora generation
    const soraValidation = validateSoraPrompt(clip.sora_prompt, clip.preset_key);
    console.log(`[Video] Sora prompt quality: ${soraValidation.score}/100`);

    let finalPrompt = clip.sora_prompt;

    // If prompt quality is below threshold, enhance it
    if (soraValidation.score < 60) {
      console.log(`[Video] Enhancing low-quality prompt (score: ${soraValidation.score})`);
      finalPrompt = enhanceSoraPrompt(clip.sora_prompt, clip.preset_key);

      await supabase
        .from("clips")
        .update({ sora_prompt: finalPrompt })
        .eq("id", job.clip_id);

      console.log(`[Video] Enhanced prompt saved to clip`);
    }

    // Log any warnings (but don't block)
    if (soraValidation.warnings.length > 0) {
      console.warn(`[Video] Prompt warnings: ${soraValidation.warnings.join(", ")}`);
    }

    if (soraValidation.score < 40) {
      console.error(`[Video] Prompt quality critically low (${soraValidation.score}/100). Issues: ${soraValidation.issues.join(", ")}`);
    }

    // Update clip status to rendering
    await supabase
      .from("clips")
      .update({ status: "rendering" })
      .eq("id", job.clip_id);

    // Check if the service supports async submit
    if (videoService.submitVideo) {
      // ASYNC PATH: Submit and re-queue for polling
      const taskId = await videoService.submitVideo({
        prompt: finalPrompt,
        clip_id: job.clip_id,
        duration: duration_seconds,
        aspect_ratio: "9:16",
      });

      console.log(`[Video Submit] Sora task submitted: ${taskId}`);

      // Save task_id to job payload and re-queue for polling
      const updatedPayload = { ...job.payload_json, sora_task_id: taskId };

      await supabase.rpc("complete_job", {
        p_job_id: job.id,
        p_status: "queued",
        p_error: null,
        p_payload: updatedPayload,
        p_reset_attempts: true,
      }).catch(() => {
        // Fallback: direct update if new RPC signature not yet deployed
        return supabase
          .from("jobs")
          .update({
            status: "queued",
            payload_json: updatedPayload,
            attempts: 0,
            updated_at: new Date().toISOString()
          })
          .eq("id", job.id);
      });

      console.log(`[Video Submit] Job re-queued with task_id for polling`);

      // Throw polling signal so outer handler doesn't mark as "done"
      const pollingSignal: any = new Error("__videoPolling");
      pollingSignal.__videoPolling = true;
      throw pollingSignal;

    } else {
      // SYNC PATH (fallback for mock service): Generate in one shot
      const result = await withTimeout(
        videoService.generateVideo({
          prompt: finalPrompt,
          clip_id: job.clip_id,
          duration: duration_seconds,
          aspect_ratio: "9:16",
        }),
        45000,
        "Video generation"
      );

      raw_video_url = result.raw_video_url;
      duration_seconds = result.duration_seconds || duration_seconds;

      await supabase
        .from("clips")
        .update({
          raw_video_url,
          video_service: videoService.name,
        })
        .eq("id", job.clip_id);

      await createChildJobIfNotExists(supabase, job.batch_id, job.clip_id, "assemble", {
        duration_seconds
      });
    }
  }
}

// Handle assemble job - final assembly using AI service
async function handleAssembleJob(supabase: any, job: any, services: ReturnType<typeof getServices>) {
  const assemblyService = services.getAssemblyService();
  
  // Get clip details
  const { data: clip, error: clipError } = await supabase
    .from("clips")
    .select("raw_video_url, voice_url, on_screen_text_json, preset_key, final_url, status")
    .eq("id", job.clip_id)
    .single();
  
  if (clipError) throw clipError;
  if (!clip?.raw_video_url) throw new Error("No raw video found for clip");
  
  // IDEMPOTENCY: Check if already assembled
  if (clip.final_url && clip.status === "ready") {
    console.log(`Clip ${job.clip_id} already assembled, skipping`);
    return;
  }
  
  // Update clip status to assembling
  await supabase
    .from("clips")
    .update({ status: "assembling" })
    .eq("id", job.clip_id);
  
  // Get overlay config for preset
  const overlayConfig = PRESET_OVERLAY_CONFIGS[clip.preset_key] || PRESET_OVERLAY_CONFIGS.RAW_UGC_V1;
  
  // Get video duration from job payload (passed from video job) or default to 15s
  const videoDuration = job.payload_json?.duration_seconds || 15;
  console.log(`[Assemble] Using video duration: ${videoDuration}s`);
  
  // Assemble final video
  const { final_url, duration_seconds } = await withTimeout(
    assemblyService.assembleVideo({
      clip_id: job.clip_id,
      raw_video_url: clip.raw_video_url,
      voice_url: clip.voice_url,
      on_screen_text_json: clip.on_screen_text_json || [],
      preset_key: clip.preset_key,
      overlay_config: overlayConfig,
      duration_sec: videoDuration, // Pass duration for sync
    }),
    30000,
    "Video assembly"
  );
  
  // Update clip as ready
  await supabase
    .from("clips")
    .update({
      final_url,
      status: "ready",
      assembly_service: assemblyService.name,
    })
    .eq("id", job.clip_id);
}

// Handle image compile job - generates prompts for all images
async function handleImageCompileJob(supabase: any, job: any, services: ReturnType<typeof getServices>) {
  const { intent_text, preset_key, image_type, aspect_ratio } = job.payload_json;
  const scriptService = services.getScriptService();
  
  // Get all clips for this batch
  const { data: clips, error } = await supabase
    .from("clips")
    .select("*")
    .eq("batch_id", job.batch_id)
    .order("variant_id");

  if (error) throw error;
  if (!clips || clips.length === 0) throw new Error("No clips found for batch");

  // Generate image prompts for each clip
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    
    // IDEMPOTENCY: Skip clips that already have image prompts (from previous partial run)
    if (clip.image_prompt && clip.status !== "planned") {
      console.log(`Clip ${clip.id} already has image prompt, skipping generation`);
      // Still ensure image job exists
      await createChildJobIfNotExists(supabase, job.batch_id, clip.id, "image", { 
        prompt: clip.image_prompt,
        image_type: clip.image_type || image_type,
        aspect_ratio: clip.aspect_ratio || aspect_ratio,
      });
      continue;
    }
    
    // Update status to scripting
    await supabase
      .from("clips")
      .update({ status: "scripting" })
      .eq("id", clip.id);
    
    // Generate image prompt using AI
    const scriptOutput = await withTimeout(
      scriptService.generateScript({
        intent_text: `Generate a ${image_type} image prompt for: ${intent_text}. 
          Create variation ${i + 1} with a unique angle, composition, or style.
          Return the image_prompt field as a detailed image generation prompt.`,
        preset_key,
        mode: "hook_test",
        variant_index: i,
        batch_size: clips.length,
      }),
      30000,
      "Image prompt generation"
    );
    
    // Extract image prompt from script output
    const imagePrompt = scriptOutput.sora_prompt || 
      `${intent_text}, ${image_type} style, professional quality, variation ${i + 1}`;
    
    // Update clip with image prompt
    await supabase
      .from("clips")
      .update({
        image_prompt: imagePrompt,
        image_type,
        aspect_ratio,
        status: "planned",
        script_service: scriptService.name,
      })
      .eq("id", clip.id);
    
    // IDEMPOTENT: Create image job only if it doesn't already exist
    await createChildJobIfNotExists(supabase, job.batch_id, clip.id, "image", { 
      prompt: imagePrompt,
      image_type,
      aspect_ratio,
    });
  }
}

// Handle image job - generates a single image
async function handleImageJob(supabase: any, job: any, services: ReturnType<typeof getServices>) {
  const imageService = services.getImageService();
  const { prompt, image_type, aspect_ratio } = job.payload_json;
  
  if (!prompt) throw new Error("No prompt provided for image generation");
  
  // IDEMPOTENCY: Check if image already exists
  const { data: existingClip } = await supabase
    .from("clips")
    .select("image_url, status")
    .eq("id", job.clip_id)
    .single();
  
  if (existingClip?.image_url && existingClip.status === "ready") {
    console.log(`Clip ${job.clip_id} already has image, skipping generation`);
    return;
  }
  
  // Update clip status to generating
  await supabase
    .from("clips")
    .update({ status: "generating" })
    .eq("id", job.clip_id);
  
  // Generate image using AI service
  const { image_url, width, height } = await withTimeout(
    imageService.generateImage({
      prompt,
      clip_id: job.clip_id,
      image_type: image_type || "product",
      aspect_ratio: aspect_ratio || "1:1",
    }),
    30000,
    "Image generation"
  );
  
  // Update clip as ready
  await supabase
    .from("clips")
    .update({
      image_url,
      final_url: image_url,
      status: "ready",
      image_service: imageService.name,
    })
    .eq("id", job.clip_id);
}

// =============================================================================
// RESEARCH JOB - Claude Brain + Apify Scraping
// This is the FIRST step in the pipeline - analyzes prompt and gathers examples
// =============================================================================

async function handleResearchJob(supabase: any, job: any, services: ReturnType<typeof getServices>) {
  const { intent_text, preset_key, mode, output_type } = job.payload_json;
  const researchService = services.getResearchService();
  
  console.log(`[Research] Starting brain analysis for: "${intent_text}"`);
  
  // ═══════════════════════════════════════════════════════════════
  // VALIDATION: Check batch still exists and is valid before processing
  // This prevents zombie jobs from running on deleted batches
  // ═══════════════════════════════════════════════════════════════
  const { data: batch, error: batchError } = await supabase
    .from("batches")
    .select("id, status")
    .eq("id", job.batch_id)
    .single();
  
  if (batchError || !batch) {
    throw new Error(`Batch ${job.batch_id} no longer exists - aborting research`);
  }
  
  if (batch.status === "cancelled" || batch.status === "failed") {
    console.log(`[Research] Batch ${job.batch_id} is ${batch.status}, skipping`);
    return; // Exit cleanly without creating child jobs
  }
  
  // STEP 0: Detect content category from user prompt
  const category = detectCategory(intent_text);
  const categoryConfig = CATEGORY_DETECTION[category];
  const viralThreshold = getViralThreshold(category);
  
  console.log(`[Research] 🎯 Detected category: ${category.toUpperCase()}`);
  console.log(`[Research] 📊 Category: ${categoryConfig.description}`);
  console.log(`[Research] 🔥 Viral threshold: ${viralThreshold.toLocaleString()} views`);
  
  // Update batch status to researching
  await supabase
    .from("batches")
    .update({ status: "researching" })
    .eq("id", job.batch_id);

  let researchContext: {
    scraped_videos: ScrapedVideo[];
    trend_analysis: TrendAnalysis | null;
    search_query: string;
    research_summary: string;
    category: ContentCategory;
    category_info: { description: string; viral_threshold: number };
  } = {
    scraped_videos: [],
    trend_analysis: null,
    search_query: "",
    research_summary: "",
    category: category,
    category_info: {
      description: categoryConfig.description,
      viral_threshold: viralThreshold,
    },
  };

  try {
    // STEP 1: Use Claude brain to analyze the prompt and generate smart search query
    const searchQuery = await analyzePromptWithClaude(intent_text, preset_key, category);
    researchContext.search_query = searchQuery;
    console.log(`[Research] Claude brain generated search query: "${searchQuery}"`);

    // STEP 2: Use Apify to scrape TikTok examples based on the query
    // NOW with category-aware viral filtering
    console.log(`[Research] Apify scraping VIRAL ${category} examples for: "${searchQuery}"`);
    const scrapedVideos = await withTimeout(
      researchService.searchVideos({
        query: searchQuery,
        platform: "tiktok",
        limit: 15,
        sort_by: "views",
        category: category,
        min_views: viralThreshold,
      }),
      120000, // 2 min timeout for scraping
      "Apify scraping"
    );
    researchContext.scraped_videos = scrapedVideos;
    console.log(`[Research] Scraped ${scrapedVideos.length} VIRAL ${category} videos`);

    // STEP 3: Use Claude Sonnet to analyze the scraped content for patterns
    if (scrapedVideos.length > 0) {
      console.log(`[Research] 🔬 Analyzing ${scrapedVideos.length} viral videos with Claude Sonnet...`);
      const analysis = await withTimeout(
        researchService.analyzeVideos(searchQuery, scrapedVideos, category),
        60000, // 1 min timeout for analysis
        "Trend analysis"
      );
      researchContext.trend_analysis = analysis;
      
      // Generate a summary for the script service
      researchContext.research_summary = generateResearchSummary(analysis, scrapedVideos, category);
      console.log(`[Research] Analysis complete - found ${analysis.hook_patterns.length} hook patterns`);
    }

  } catch (researchError: any) {
    // Research is optional - if it fails, log and continue with basic compile
    console.warn(`[Research] Research step failed (will continue without): ${researchError.message}`);
    researchContext.research_summary = "Research unavailable - using standard generation.";
  }

  // STEP 4: Store research results in batch metadata
  await supabase
    .from("batches")
    .update({ 
      research_json: researchContext,
      status: "running"
    })
    .eq("id", job.batch_id);

  // STEP 5: Create the compile job with research context
  const compilePayload = {
    ...job.payload_json,
    research_context: researchContext,
  };

  const compileJobType = output_type === "image" ? "image_compile" : "compile";
  await createChildJobIfNotExists(supabase, job.batch_id, null, compileJobType, compilePayload);
  
  console.log(`[Research] Created ${compileJobType} job with research context`);
}

/**
 * CLAUDE BRAIN - The intelligent core of the research system
 * Uses Claude 3.5 Sonnet for BEST accuracy in understanding user intent
 * 
 * EFFICIENCY: Single focused call, ~200 tokens, <1 second
 * COST: ~$0.003 per call (very efficient)
 */
async function analyzePromptWithClaude(intentText: string, presetKey: string, category: ContentCategory): Promise<string> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const categoryConfig = CATEGORY_DETECTION[category];
  
  if (!anthropicKey) {
    console.warn("[Claude Brain] No API key, using intent as search query");
    return extractSearchTerms(intentText, category);
  }

  // Get trending hashtags and niche terms for this category
  const trendingHashtags = categoryConfig.trending_hashtags?.slice(0, 3) || [];
  const nicheTerms = categoryConfig.niche_terms?.slice(0, 3) || [];

  try {
    console.log(`[Claude Brain] 🧠 Analyzing prompt with Sonnet...`);
    
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // USE SONNET for best accuracy - worth the small cost increase for better results
        model: Deno.env.get("CLAUDE_BRAIN_MODEL") || "claude-3-5-sonnet-20241022",
        max_tokens: 100, // Keep it short - just need the query
        messages: [{
          role: "user",
          content: `TASK: Generate the BEST TikTok search query to find VIRAL (500K+ views) examples.

INTENT: "${intentText}"
CATEGORY: ${category} (${categoryConfig.description})
TRENDING: ${trendingHashtags.map(h => `#${h}`).join(" ")}
NICHE TERMS: ${nicheTerms.join(", ")}

OUTPUT: Return ONLY 3-5 search words. Use EXACT creator terminology. Be SPECIFIC, not generic.

QUERY:`
        }]
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const query = data.content?.[0]?.text?.trim() || "";
    
    // Clean up the query
    const cleanQuery = query.replace(/["']/g, "").replace(/^query:?\s*/i, "").trim();
    
    console.log(`[Claude Brain] ✅ Generated query: "${cleanQuery}"`);
    
    return cleanQuery || extractSearchTerms(intentText, category);
    
  } catch (error) {
    console.warn("[Claude Brain] Analysis failed, using fallback:", error);
    return extractSearchTerms(intentText, category);
  }
}

/**
 * Fallback: Extract search terms from intent text
 * Now category-aware to include relevant hashtags
 */
function extractSearchTerms(intentText: string, category?: ContentCategory): string {
  // Remove common words and extract key terms
  const stopWords = new Set(["i", "want", "to", "make", "create", "about", "for", "the", "a", "an", "my", "your", "their", "video", "content", "clip"]);
  const words = intentText.toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  
  let query = words.slice(0, 3).join(" ") || intentText.slice(0, 50);
  
  // Add category hashtag if available
  if (category && CATEGORY_DETECTION[category]) {
    const topHashtag = CATEGORY_DETECTION[category].hashtags[0];
    if (topHashtag) {
      query += ` #${topHashtag}`;
    }
  }
  
  return query;
}

/**
 * Generate human-readable research summary for script service
 * Now includes category context
 */
function generateResearchSummary(
  analysis: TrendAnalysis, 
  videos: ScrapedVideo[], 
  category?: ContentCategory
): string {
  const topHooks = analysis.hook_patterns.slice(0, 3).map(p => p.pattern);
  const avgViews = videos.reduce((sum, v) => sum + v.views, 0) / videos.length;
  const topVideo = videos[0];
  const categoryInfo = category ? CATEGORY_DETECTION[category] : null;
  
  return `RESEARCH FINDINGS (${videos.length} viral ${category?.toUpperCase() || ""} examples analyzed):
${categoryInfo ? `\n🎯 CATEGORY: ${categoryInfo.description}\n📊 VIRAL THRESHOLD: ${categoryInfo.min_viral_views.toLocaleString()}+ views` : ""}

TOP HOOK PATTERNS IN THIS NICHE:
${topHooks.map((h, i) => `${i + 1}. ${h}`).join("\n")}

CONTENT STRUCTURE:
- Average duration: ${analysis.content_structure.avg_duration_seconds}s
- Common formats: ${analysis.content_structure.common_formats.join(", ")}
- Pacing: ${analysis.content_structure.pacing}

ENGAGEMENT DRIVERS: ${analysis.engagement_drivers.slice(0, 3).join(", ")}

TOP PERFORMER (${Math.round(avgViews).toLocaleString()} avg views):
"${topVideo?.hook_text || topVideo?.caption.slice(0, 100)}"
${topVideo?.hashtags?.length ? `Hashtags: ${topVideo.hashtags.slice(0, 5).map(h => `#${h}`).join(" ")}` : ""}

RECOMMENDED HOOKS TO TEST:
${analysis.recommended_hooks.slice(0, 3).map((h, i) => `${i + 1}. "${h.hook}" - ${h.reasoning}`).join("\n")}`;
}

// Check if all clips in batch are done
async function checkBatchCompletion(supabase: any, batchId: string) {
  const { data: clips, error } = await supabase
    .from("clips")
    .select("status")
    .eq("batch_id", batchId);

  if (error) {
    console.error("Error checking batch completion:", error);
    return;
  }

  const allReady = clips.every((c: any) => c.status === "ready");
  const anyFailed = clips.some((c: any) => c.status === "failed");

  if (allReady || anyFailed) {
    const newStatus = anyFailed ? "failed" : "done";
    
    await supabase
      .from("batches")
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", batchId);
    
    // If batch failed, refund user credits
    if (anyFailed) {
      try {
        await supabase.rpc("refund_batch", { p_batch_id: batchId });
        console.log(`Refunded credits for failed batch ${batchId}`);
      } catch (refundError) {
        console.error(`Failed to refund batch ${batchId}:`, refundError);
      }
    }
  }
}
