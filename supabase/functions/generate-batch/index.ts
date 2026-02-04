// FEEDR Terminal - Generate Batch Edge Function
// POST /functions/v1/generate-batch
// Supports both VIDEO and IMAGE generation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type OutputType = "video" | "image";
type ImageType = "product" | "lifestyle" | "ad" | "ugc" | "hero" | "custom";

interface GenerateBatchRequest {
  intent_text: string;
  preset_key: string;
  mode: "hook_test" | "angle_test" | "format_test";
  batch_size: 5 | 10 | 15;
  // New fields for image support
  output_type?: OutputType;
  image_type?: ImageType;
  aspect_ratio?: string;
  // Smart image packs
  image_pack?: string;
  image_prompts?: Array<{ prompt: string; aspectRatio: string; type: string }>;
}

// Simple AUTO preset resolver
function resolvePreset(intentText: string, requestedPreset: string, outputType: OutputType): string {
  if (requestedPreset !== "AUTO") {
    return requestedPreset;
  }

  // For images, detect product-related intents
  if (outputType === "image") {
    const lowerIntent = intentText.toLowerCase();
    const productKeywords = ["product", "item", "sell", "listing", "shop"];
    const lifestyleKeywords = ["lifestyle", "use", "wearing", "using", "action"];
    const adKeywords = ["ad", "advertisement", "promo", "sale", "offer"];
    
    for (const keyword of adKeywords) {
      if (lowerIntent.includes(keyword)) return "AD_BOLD";
    }
    for (const keyword of lifestyleKeywords) {
      if (lowerIntent.includes(keyword)) return "PRODUCT_LIFESTYLE";
    }
    for (const keyword of productKeywords) {
      if (lowerIntent.includes(keyword)) return "PRODUCT_CLEAN";
    }
    
    return "PRODUCT_CLEAN";
  }
  
  // For videos (existing logic)
  const lowerIntent = intentText.toLowerCase();
  const adKeywords = ["buy", "sale", "offer", "discount", "quiz", "cta", "shop", "order", "deal"];
  
  for (const keyword of adKeywords) {
    if (lowerIntent.includes(keyword)) {
      return "TIKTOK_AD_V1";
    }
  }
  
  return "RAW_UGC_V1";
}

// Generate variant ID (V01, V02, etc.)
function formatVariantId(index: number): string {
  return `V${String(index + 1).padStart(2, "0")}`;
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

    // Parse request body
    const body: GenerateBatchRequest = await req.json();
    const { 
      intent_text, 
      preset_key, 
      mode, 
      batch_size,
      output_type = "video",
      image_type = "product",
      aspect_ratio = "1:1",
      image_pack = "auto",
      image_prompts,
    } = body;

    // Validate input
    if (!intent_text?.trim()) {
      return new Response(
        JSON.stringify({ error: "intent_text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["hook_test", "angle_test", "format_test"].includes(mode)) {
      return new Response(
        JSON.stringify({ error: "Invalid mode" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (![5, 10, 15].includes(batch_size)) {
      return new Response(
        JSON.stringify({ error: "Invalid batch_size" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["video", "image"].includes(output_type)) {
      return new Response(
        JSON.stringify({ error: "Invalid output_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve preset for AUTO
    const resolvedPreset = resolvePreset(intent_text, preset_key, output_type);

    // 1. Create batch row
    const { data: batch, error: batchError } = await supabase
      .from("batches")
      .insert({
        intent_text,
        preset_key,
        mode,
        batch_size,
        output_type,
        status: "queued",
      })
      .select()
      .single();

    if (batchError) {
      throw new Error(`Failed to create batch: ${batchError.message}`);
    }

    // 2. Update batch to running
    await supabase
      .from("batches")
      .update({ status: "running" })
      .eq("id", batch.id);

    // 3. Create clip rows (structure varies by output type)
    const clipsToInsert = [];
    const clipCount = output_type === "image" && image_prompts ? image_prompts.length : batch_size;
    
    for (let i = 0; i < clipCount; i++) {
      const clipData: any = {
        batch_id: batch.id,
        variant_id: formatVariantId(i),
        segment_type: "single",
        status: "planned",
        preset_key: resolvedPreset,
        winner: false,
        killed: false,
      };

      // Add image-specific fields (use pre-generated prompts if available)
      if (output_type === "image") {
        if (image_prompts && image_prompts[i]) {
          clipData.image_prompt = image_prompts[i].prompt;
          clipData.image_type = image_prompts[i].type;
          clipData.aspect_ratio = image_prompts[i].aspectRatio;
        } else {
          clipData.image_type = image_type;
          clipData.aspect_ratio = aspect_ratio;
        }
      }

      clipsToInsert.push(clipData);
    }

    const { error: clipsError } = await supabase
      .from("clips")
      .insert(clipsToInsert);

    if (clipsError) {
      throw new Error(`Failed to create clips: ${clipsError.message}`);
    }

    // 4. Enqueue appropriate job based on output type
    // For images with pre-generated prompts, skip compile and go straight to image jobs
    if (output_type === "image" && image_prompts && image_prompts.length > 0) {
      // Get the clip IDs we just created
      const { data: createdClips } = await supabase
        .from("clips")
        .select("id")
        .eq("batch_id", batch.id)
        .order("variant_id");
      
      // Create individual image jobs for each clip
      const imageJobs = (createdClips || []).map((clip: any, i: number) => ({
        batch_id: batch.id,
        clip_id: clip.id,
        type: "image",
        status: "queued",
        payload_json: {
          prompt: image_prompts[i]?.prompt || intent_text,
          image_type: image_prompts[i]?.type || image_type,
          aspect_ratio: image_prompts[i]?.aspectRatio || aspect_ratio,
        },
      }));
      
      const { error: jobError } = await supabase.from("jobs").insert(imageJobs);
      if (jobError) throw new Error(`Failed to create jobs: ${jobError.message}`);
    } else {
      // Standard flow - create compile job
      const jobType = output_type === "image" ? "image_compile" : "compile";
      const { error: jobError } = await supabase
        .from("jobs")
        .insert({
          batch_id: batch.id,
          clip_id: null,
          type: jobType,
          status: "queued",
          payload_json: { 
            intent_text, 
            preset_key: resolvedPreset, 
            mode,
            output_type,
            image_type,
            aspect_ratio,
            image_pack,
          },
        });
      if (jobError) throw new Error(`Failed to create job: ${jobError.message}`);
    }

    // Return batch_id
    return new Response(
      JSON.stringify({ batch_id: batch.id, output_type }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in generate-batch:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
