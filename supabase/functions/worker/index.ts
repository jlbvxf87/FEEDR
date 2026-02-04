// FEEDR Terminal - Worker Edge Function
// POST /functions/v1/worker (body: { action: "run-once" })

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { getServices } from "../_shared/services/index.ts";
import { PRESET_OVERLAY_CONFIGS } from "../_shared/services/assembly/interface.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get services
    const services = getServices();
    const serviceConfig = services.getServiceConfig();
    console.log("Worker using services:", serviceConfig);

    // Get the oldest queued job
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (jobError && jobError.code !== "PGRST116") {
      throw new Error(`Failed to fetch job: ${jobError.message}`);
    }

    if (!job) {
      return new Response(
        JSON.stringify({ processed: false, message: "No queued jobs" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark job as running
    await supabase
      .from("jobs")
      .update({ status: "running", attempts: job.attempts + 1 })
      .eq("id", job.id);

    // Process job based on type
    try {
      const startTime = Date.now();
      
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

      const duration = Date.now() - startTime;

      // Log service usage
      await supabase.from("service_logs").insert({
        batch_id: job.batch_id,
        clip_id: job.clip_id,
        service_type: job.type === "compile" ? "script" : job.type,
        service_name: serviceConfig[job.type === "compile" ? "script" : job.type as keyof typeof serviceConfig],
        duration_ms: duration,
      });

      // Mark job as done
      await supabase
        .from("jobs")
        .update({ status: "done" })
        .eq("id", job.id);

      // Check if batch is complete
      await checkBatchCompletion(supabase, job.batch_id);

    } catch (jobError: any) {
      // Mark job as failed
      await supabase
        .from("jobs")
        .update({ status: "failed", error: jobError.message })
        .eq("id", job.id);
      
      // Log the error
      await supabase.from("service_logs").insert({
        batch_id: job.batch_id,
        clip_id: job.clip_id,
        service_type: job.type,
        service_name: "unknown",
        error: jobError.message,
      });
      
      throw jobError;
    }

    return new Response(
      JSON.stringify({ processed: true, job_id: job.id, job_type: job.type }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
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

  // Process each clip
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    
    // Update status to scripting
    await supabase
      .from("clips")
      .update({ status: "scripting" })
      .eq("id", clip.id);
    
    // Generate script using AI service
    const { script_spoken, on_screen_text_json, sora_prompt } = await scriptService.generateScript({
      intent_text,
      preset_key,
      mode,
      variant_index: i,
      batch_size: clips.length,
    });
    
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
    
    // Enqueue TTS job for this clip
    await supabase
      .from("jobs")
      .insert({
        batch_id: job.batch_id,
        clip_id: clip.id,
        type: "tts",
        status: "queued",
        payload_json: { script: script_spoken },
      });
  }
}

// Handle TTS job - generates voice audio using AI service
async function handleTtsJob(supabase: any, job: any, services: ReturnType<typeof getServices>) {
  const voiceService = services.getVoiceService();
  
  // Get clip details
  const { data: clip, error: clipError } = await supabase
    .from("clips")
    .select("script_spoken")
    .eq("id", job.clip_id)
    .single();
  
  if (clipError) throw clipError;
  
  // Update clip status to vo
  await supabase
    .from("clips")
    .update({ status: "vo" })
    .eq("id", job.clip_id);
  
  // Generate voice using AI service
  const { voice_url, duration_seconds } = await voiceService.generateVoice({
    script: clip.script_spoken,
    clip_id: job.clip_id,
  });
  
  // Update clip with voice URL
  await supabase
    .from("clips")
    .update({ 
      voice_url,
      voice_service: voiceService.name,
    })
    .eq("id", job.clip_id);
  
  // Enqueue video job
  await supabase
    .from("jobs")
    .insert({
      batch_id: job.batch_id,
      clip_id: job.clip_id,
      type: "video",
      status: "queued",
      payload_json: { duration_seconds },
    });
}

// Handle video job - generates raw video using AI service
async function handleVideoJob(supabase: any, job: any, services: ReturnType<typeof getServices>) {
  const videoService = services.getVideoService();
  
  // Get clip details
  const { data: clip, error: clipError } = await supabase
    .from("clips")
    .select("sora_prompt")
    .eq("id", job.clip_id)
    .single();
  
  if (clipError) throw clipError;
  
  // Update clip status to rendering
  await supabase
    .from("clips")
    .update({ status: "rendering" })
    .eq("id", job.clip_id);
  
  // Generate video using AI service
  const { raw_video_url, duration_seconds } = await videoService.generateVideo({
    prompt: clip.sora_prompt,
    clip_id: job.clip_id,
    duration: job.payload_json.duration_seconds || 15,
    aspect_ratio: "9:16",
  });
  
  // Update clip with video URL
  await supabase
    .from("clips")
    .update({ 
      raw_video_url,
      video_service: videoService.name,
    })
    .eq("id", job.clip_id);
  
  // Enqueue assemble job
  await supabase
    .from("jobs")
    .insert({
      batch_id: job.batch_id,
      clip_id: job.clip_id,
      type: "assemble",
      status: "queued",
      payload_json: { duration_seconds },
    });
}

// Handle assemble job - final assembly using AI service
async function handleAssembleJob(supabase: any, job: any, services: ReturnType<typeof getServices>) {
  const assemblyService = services.getAssemblyService();
  
  // Get clip details
  const { data: clip, error: clipError } = await supabase
    .from("clips")
    .select("raw_video_url, voice_url, on_screen_text_json, preset_key")
    .eq("id", job.clip_id)
    .single();
  
  if (clipError) throw clipError;
  
  // Update clip status to assembling
  await supabase
    .from("clips")
    .update({ status: "assembling" })
    .eq("id", job.clip_id);
  
  // Get overlay config for preset
  const overlayConfig = PRESET_OVERLAY_CONFIGS[clip.preset_key] || PRESET_OVERLAY_CONFIGS.RAW_UGC_V1;
  
  // Assemble final video
  const { final_url, duration_seconds } = await assemblyService.assembleVideo({
    clip_id: job.clip_id,
    raw_video_url: clip.raw_video_url,
    voice_url: clip.voice_url,
    on_screen_text_json: clip.on_screen_text_json || [],
    preset_key: clip.preset_key,
    overlay_config: overlayConfig,
  });
  
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

  // Generate image prompts for each clip (using script service for prompt engineering)
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    
    // Update status to scripting (reusing for prompt generation)
    await supabase
      .from("clips")
      .update({ status: "scripting" })
      .eq("id", clip.id);
    
    // Generate image prompt using AI
    const scriptOutput = await scriptService.generateScript({
      intent_text: `Generate a ${image_type} image prompt for: ${intent_text}. 
        Create variation ${i + 1} with a unique angle, composition, or style.
        Return the image_prompt field as a detailed image generation prompt.`,
      preset_key,
      mode: "hook_test",
      variant_index: i,
      batch_size: clips.length,
    });
    
    // Extract image prompt from script output (adapt as needed)
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
    
    // Enqueue image generation job for this clip
    await supabase
      .from("jobs")
      .insert({
        batch_id: job.batch_id,
        clip_id: clip.id,
        type: "image",
        status: "queued",
        payload_json: { 
          prompt: imagePrompt,
          image_type,
          aspect_ratio,
        },
      });
  }
}

// Handle image job - generates a single image
async function handleImageJob(supabase: any, job: any, services: ReturnType<typeof getServices>) {
  const imageService = services.getImageService();
  const { prompt, image_type, aspect_ratio } = job.payload_json;
  
  // Update clip status to generating
  await supabase
    .from("clips")
    .update({ status: "generating" })
    .eq("id", job.clip_id);
  
  // Generate image using AI service
  const { image_url, width, height } = await imageService.generateImage({
    prompt,
    clip_id: job.clip_id,
    image_type: image_type || "product",
    aspect_ratio: aspect_ratio || "1:1",
  });
  
  // Update clip as ready (images don't need assembly)
  await supabase
    .from("clips")
    .update({
      image_url,
      final_url: image_url, // For images, final_url is the image
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

  if (error) throw error;

  const allReady = clips.every((c: any) => c.status === "ready");
  const anyFailed = clips.some((c: any) => c.status === "failed");

  if (allReady || anyFailed) {
    await supabase
      .from("batches")
      .update({ status: anyFailed ? "failed" : "done" })
      .eq("id", batchId);
  }
}
