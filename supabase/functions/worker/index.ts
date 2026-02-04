// FEEDR Terminal - Worker Edge Function
// POST /functions/v1/worker (body: { action: "run-once" })
//
// Uses atomic job claiming to prevent race conditions when multiple workers run concurrently.
// All child job creation is idempotent to handle retries safely.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { getServices } from "../_shared/services/index.ts";
import { PRESET_OVERLAY_CONFIGS } from "../_shared/services/assembly/interface.ts";

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
async function createChildJobIfNotExists(
  supabase: any,
  batchId: string,
  clipId: string | null,
  type: string,
  payload: any
): Promise<string | null> {
  const { data, error } = await supabase.rpc("create_child_job_if_not_exists", {
    p_batch_id: batchId,
    p_clip_id: clipId,
    p_type: type,
    p_payload: payload,
  });
  
  if (error) {
    console.error(`Failed to create ${type} job:`, error.message);
    // Fallback to direct insert if RPC not available (backwards compatibility)
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
    
    if (insertError) throw insertError;
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

    // Check if job has exceeded max retries (RPC already incremented attempts)
    if (job.attempts > MAX_RETRIES) {
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
      
      console.error(`Job ${job.id} error:`, jobError.message);
      
      // Determine if we should retry or fail permanently
      // Note: attempts was already incremented by claim_next_job
      const shouldRetry = job.attempts < MAX_RETRIES;
      
      if (shouldRetry) {
        // Put back in queue for retry
        await supabase.rpc("complete_job", {
          p_job_id: job.id,
          p_status: "queued",
          p_error: `Attempt ${job.attempts} failed: ${jobError.message}`,
        }).catch(() => {
          return supabase
            .from("jobs")
            .update({ 
              status: "queued", 
              error: `Attempt ${job.attempts} failed: ${jobError.message}`,
              updated_at: new Date().toISOString()
            })
            .eq("id", job.id);
        });
      } else {
        // Mark as permanently failed
        await supabase.rpc("complete_job", {
          p_job_id: job.id,
          p_status: "failed",
          p_error: jobError.message,
        }).catch(() => {
          return supabase
            .from("jobs")
            .update({ 
              status: "failed", 
              error: jobError.message,
              updated_at: new Date().toISOString()
            })
            .eq("id", job.id);
        });
        
        // Mark clip as failed
        if (job.clip_id) {
          await supabase.from("clips").update({ 
            status: "failed", 
            error: jobError.message 
          }).eq("id", job.clip_id);
        }
      }
      
      // Log the error
      await supabase.from("service_logs").insert({
        batch_id: job.batch_id,
        clip_id: job.clip_id,
        service_type: job.type,
        service_name: "error",
        error: jobError.message,
      });

      return new Response(
        JSON.stringify({ 
          processed: false, 
          error: jobError.message, 
          job_id: job.id,
          will_retry: shouldRetry 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
async function handleCompileJob(supabase: any, job: any, services: ReturnType<typeof getServices>) {
  const { intent_text, preset_key, mode } = job.payload_json;
  const scriptService = services.getScriptService();
  
  // Get all clips for this batch
  const { data: clips, error } = await supabase
    .from("clips")
    .select("*")
    .eq("batch_id", job.batch_id)
    .order("variant_id");

  if (error) throw error;
  if (!clips || clips.length === 0) throw new Error("No clips found for batch");

  // Process each clip
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    
    // IDEMPOTENCY: Skip clips that already have scripts (from previous partial run)
    if (clip.script_spoken && clip.status !== "planned") {
      console.log(`Clip ${clip.id} already has script, skipping generation`);
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
    const scriptOutput = await withTimeout(
      scriptService.generateScript({
        intent_text,
        preset_key,
        mode,
        variant_index: i,
        batch_size: clips.length,
      }),
      30000, // 30s timeout for script generation
      "Script generation"
    );
    
    const { script_spoken, on_screen_text_json, sora_prompt } = scriptOutput;
    
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
async function handleVideoJob(supabase: any, job: any, services: ReturnType<typeof getServices>) {
  const videoService = services.getVideoService();
  
  // Get clip details
  const { data: clip, error: clipError } = await supabase
    .from("clips")
    .select("sora_prompt, raw_video_url")
    .eq("id", job.clip_id)
    .single();
  
  if (clipError) throw clipError;
  if (!clip?.sora_prompt) throw new Error("No video prompt found for clip");
  
  // IDEMPOTENCY: Skip if video already generated (from previous partial run)
  let raw_video_url = clip.raw_video_url;
  let duration_seconds = job.payload_json.duration_seconds || 15;
  
  if (!raw_video_url) {
    // Update clip status to rendering
    await supabase
      .from("clips")
      .update({ status: "rendering" })
      .eq("id", job.clip_id);
    
    // Generate video using AI service
    const result = await withTimeout(
      videoService.generateVideo({
        prompt: clip.sora_prompt,
        clip_id: job.clip_id,
        duration: duration_seconds,
        aspect_ratio: "9:16",
      }),
      45000, // 45s timeout for video
      "Video generation"
    );
    
    raw_video_url = result.raw_video_url;
    duration_seconds = result.duration_seconds;
    
    // Update clip with video URL
    await supabase
      .from("clips")
      .update({ 
        raw_video_url,
        video_service: videoService.name,
      })
      .eq("id", job.clip_id);
  } else {
    console.log(`Clip ${job.clip_id} already has raw video, skipping generation`);
  }
  
  // IDEMPOTENT: Create assemble job only if it doesn't already exist
  await createChildJobIfNotExists(supabase, job.batch_id, job.clip_id, "assemble", { 
    duration_seconds 
  });
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
  
  // Assemble final video
  const { final_url, duration_seconds } = await withTimeout(
    assemblyService.assembleVideo({
      clip_id: job.clip_id,
      raw_video_url: clip.raw_video_url,
      voice_url: clip.voice_url,
      on_screen_text_json: clip.on_screen_text_json || [],
      preset_key: clip.preset_key,
      overlay_config: overlayConfig,
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
