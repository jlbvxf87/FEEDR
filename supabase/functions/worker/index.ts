// FEEDR Terminal - Worker Edge Function
// POST /functions/v1/worker (body: { action: "run-once" })

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Placeholder video URL for mock rendering
const PLACEHOLDER_VIDEO_URL = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4";
const PLACEHOLDER_AUDIO_URL = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYNkEsAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYNkEsAAAAAAAAAAAAAAAAA";

// Mock script templates
const HOOK_TEMPLATES = [
  "Wait, you need to see this...",
  "Nobody talks about this but...",
  "Here's what they don't tell you about {topic}",
  "I tested {topic} so you don't have to",
  "Stop scrolling if you're dealing with {topic}",
  "The {topic} secret nobody shares",
  "Why is everyone ignoring {topic}?",
  "This changes everything about {topic}",
  "I was today years old when I learned this about {topic}",
  "POV: You just discovered {topic}",
  "The truth about {topic} that shocked me",
  "If you're struggling with {topic}, watch this",
  "Real talk about {topic}",
  "This {topic} hack is insane",
  "My honest experience with {topic}",
];

// Generate mock script content
function generateMockScript(intentText: string, variantIndex: number): {
  script_spoken: string;
  on_screen_text_json: Array<{ t: number; text: string }>;
  sora_prompt: string;
} {
  const topic = intentText.split(" ").slice(0, 3).join(" ");
  const hookTemplate = HOOK_TEMPLATES[variantIndex % HOOK_TEMPLATES.length];
  const hook = hookTemplate.replace("{topic}", topic);
  
  const script_spoken = `${hook} So I've been researching ${intentText} for weeks now, and what I found is actually surprising. Most people think they know about this, but they're missing the key insight. Let me break it down for you real quick.`;
  
  const on_screen_text_json = [
    { t: 0.0, text: hook },
    { t: 2.5, text: "Here's what I found..." },
    { t: 5.0, text: `The truth about ${topic}` },
    { t: 7.5, text: "Watch till the end" },
  ];
  
  const sora_prompt = `A person talking directly to camera in vertical smartphone format, casual setting, warm lighting. They are explaining something with engaged facial expressions. The topic is about ${intentText}. Natural hand gestures, authentic feel, 9:16 aspect ratio.`;
  
  return { script_spoken, on_screen_text_json, sora_prompt };
}

// Add artificial delay to simulate real processing
async function simulateDelay(ms: number = 500) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

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
      switch (job.type) {
        case "compile":
          await handleCompileJob(supabase, job);
          break;
        case "tts":
          await handleTtsJob(supabase, job);
          break;
        case "video":
          await handleVideoJob(supabase, job);
          break;
        case "assemble":
          await handleAssembleJob(supabase, job);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      // Mark job as done
      await supabase
        .from("jobs")
        .update({ status: "done" })
        .eq("id", job.id);

      // Check if batch is complete
      await checkBatchCompletion(supabase, job.batch_id);

    } catch (jobError) {
      // Mark job as failed
      await supabase
        .from("jobs")
        .update({ status: "failed", error: jobError.message })
        .eq("id", job.id);
      throw jobError;
    }

    return new Response(
      JSON.stringify({ processed: true, job_id: job.id, job_type: job.type }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in worker:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Handle compile job - generates scripts for all clips
async function handleCompileJob(supabase: any, job: any) {
  const { intent_text } = job.payload_json;
  
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
    
    await simulateDelay(300);
    
    // Generate mock script
    const { script_spoken, on_screen_text_json, sora_prompt } = generateMockScript(
      intent_text,
      i
    );
    
    // Update clip with script data and set back to planned (ready for TTS)
    await supabase
      .from("clips")
      .update({
        script_spoken,
        on_screen_text_json,
        sora_prompt,
        status: "planned",
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

// Handle TTS job - generates voice audio
async function handleTtsJob(supabase: any, job: any) {
  // Update clip status to vo
  await supabase
    .from("clips")
    .update({ status: "vo" })
    .eq("id", job.clip_id);
  
  await simulateDelay(400);
  
  // Set placeholder voice URL
  await supabase
    .from("clips")
    .update({ voice_url: PLACEHOLDER_AUDIO_URL })
    .eq("id", job.clip_id);
  
  // Enqueue video job
  await supabase
    .from("jobs")
    .insert({
      batch_id: job.batch_id,
      clip_id: job.clip_id,
      type: "video",
      status: "queued",
      payload_json: {},
    });
}

// Handle video job - generates raw video
async function handleVideoJob(supabase: any, job: any) {
  // Update clip status to rendering
  await supabase
    .from("clips")
    .update({ status: "rendering" })
    .eq("id", job.clip_id);
  
  await simulateDelay(600);
  
  // Set placeholder video URL
  await supabase
    .from("clips")
    .update({ raw_video_url: PLACEHOLDER_VIDEO_URL })
    .eq("id", job.clip_id);
  
  // Enqueue assemble job
  await supabase
    .from("jobs")
    .insert({
      batch_id: job.batch_id,
      clip_id: job.clip_id,
      type: "assemble",
      status: "queued",
      payload_json: {},
    });
}

// Handle assemble job - final assembly
async function handleAssembleJob(supabase: any, job: any) {
  // Update clip status to assembling
  await supabase
    .from("clips")
    .update({ status: "assembling" })
    .eq("id", job.clip_id);
  
  await simulateDelay(500);
  
  // Set final URL (for v1, same as raw video)
  await supabase
    .from("clips")
    .update({
      final_url: PLACEHOLDER_VIDEO_URL,
      status: "ready",
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
