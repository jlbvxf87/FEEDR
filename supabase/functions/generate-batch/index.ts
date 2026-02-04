// FEEDR Terminal - Generate Batch Edge Function
// POST /functions/v1/generate-batch
// Supports both VIDEO and IMAGE generation with billing

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Upsell multiplier - user pays base cost × this value
const UPSELL_MULTIPLIER = 1.5;

type OutputType = "video" | "image";
type ImageType = "product" | "lifestyle" | "ad" | "ugc" | "hero" | "custom";
type QualityMode = "fast" | "good" | "better";

interface GenerateBatchRequest {
  intent_text: string;
  preset_key: string;
  mode: "hook_test" | "angle_test" | "format_test";
  batch_size: 2 | 4 | 6 | 8;
  // Output type
  output_type?: OutputType;
  image_type?: ImageType;
  aspect_ratio?: string;
  // Smart image packs
  image_pack?: string;
  image_prompts?: Array<{ prompt: string; aspectRatio: string; type: string }>;
  // Billing fields
  quality_mode?: QualityMode;
  estimated_cost?: number; // User charge in cents (already includes upsell)
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
    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header (if authenticated)
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

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
      quality_mode = "good",
      estimated_cost = 0,
    } = body;
    
    // Calculate costs
    // estimated_cost from frontend is already the user charge (includes upsell)
    const userChargeCents = estimated_cost;
    const baseCostCents = Math.round(userChargeCents / UPSELL_MULTIPLIER);

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

    if (![2, 4, 6, 8].includes(batch_size)) {
      return new Response(
        JSON.stringify({ error: "Invalid batch_size. Must be 2, 4, 6, or 8" }),
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

    // Check user credits if authenticated and billing is enabled
    if (userId && userChargeCents > 0) {
      const { data: credits } = await supabase
        .from("user_credits")
        .select("balance_cents")
        .eq("user_id", userId)
        .single();
      
      if (!credits || credits.balance_cents < userChargeCents) {
        return new Response(
          JSON.stringify({ 
            error: "Insufficient credits", 
            required: userChargeCents,
            available: credits?.balance_cents || 0 
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 1. Create batch row with billing info
    const { data: batch, error: batchError } = await supabase
      .from("batches")
      .insert({
        intent_text,
        preset_key,
        mode,
        batch_size,
        output_type,
        status: "queued",
        user_id: userId,
        quality_mode,
        base_cost_cents: baseCostCents,
        user_charge_cents: userChargeCents,
        payment_status: userId ? "pending" : "free", // Free if no user (dev mode)
      })
      .select()
      .single();

    if (batchError) {
      throw new Error(`Failed to create batch: ${batchError.message}`);
    }

    // 2. Deduct credits if user is authenticated
    if (userId && userChargeCents > 0) {
      const { data: deductResult, error: deductError } = await supabase
        .rpc("deduct_credits", {
          p_user_id: userId,
          p_batch_id: batch.id,
          p_amount_cents: userChargeCents,
        });
      
      if (deductError || deductResult === false) {
        // Rollback batch if credit deduction fails
        await supabase.from("batches").delete().eq("id", batch.id);
        return new Response(
          JSON.stringify({ error: "Failed to process payment" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Update batch to running
    await supabase
      .from("batches")
      .update({ status: "running" })
      .eq("id", batch.id);

    // 4. Create clip rows (structure varies by output type)
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

    // 5. Enqueue appropriate job based on output type
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

    // Return batch_id with billing info
    return new Response(
      JSON.stringify({ 
        batch_id: batch.id, 
        output_type,
        billing: {
          base_cost_cents: baseCostCents,
          user_charge_cents: userChargeCents,
          quality_mode,
        }
      }),
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
