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

// =============================================================================
// METHOD DETECTION PATTERNS - Smart AUTO analyzes prompt to pick best method
// =============================================================================

const METHOD_DETECTION_PATTERNS: Record<string, { keywords: string[]; intent: string[] }> = {
  FOUNDERS: {
    keywords: ["founder", "ceo", "built", "company", "startup", "learned", "years", "mistake", "lost", "made", "business", "entrepreneur", "raised", "sold", "scaled"],
    intent: ["authority", "experience", "business advice", "lessons", "wisdom", "mentor"]
  },
  PODCAST: {
    keywords: ["opinion", "think", "hot take", "unpopular", "debate", "disagree", "actually", "controversial", "honestly", "truth is"],
    intent: ["reaction", "commentary", "discussion", "controversial", "perspective"]
  },
  DISCOVERY: {
    keywords: ["found", "discovered", "realize", "nobody", "secret", "hidden", "hack", "trick", "just learned", "did you know", "turns out", "apparently"],
    intent: ["revelation", "surprise", "education", "tip", "insight", "breakthrough"]
  },
  CAMERA_PUT_DOWN: {
    keywords: ["quick", "real quick", "listen", "need to", "stop", "wait", "urgent", "important", "right now", "immediately"],
    intent: ["urgent", "casual", "authentic", "raw", "breaking", "news"]
  },
  SENSORY: {
    keywords: ["satisfying", "texture", "asmr", "watch", "look at", "beautiful", "mesmerizing", "soothing", "calming", "relaxing", "smooth"],
    intent: ["visual", "sensory", "relaxing", "aesthetic", "oddly satisfying"]
  },
  DELAYED_GRATIFICATION: {
    keywords: ["wait for it", "watch until", "the end", "worth it", "reveal", "transformation", "before and after", "result", "outcome", "payoff"],
    intent: ["suspense", "payoff", "before/after", "buildup", "transformation"]
  }
};

// Method configurations for structured prompts
const METHOD_CONFIGS: Record<string, {
  hook_formula: string;
  pacing: string;
  structure: string[];
  tone: string;
  visual_direction: string;
}> = {
  FOUNDERS: {
    hook_formula: "Authority statement + personal stake",
    pacing: "Measured, confident. Let points land.",
    structure: ["[0-3s] Hook with credibility/stakes", "[3-10s] Insight or contrarian take", "[10-20s] Proof/example", "[20-25s] Viewer takeaway"],
    tone: "Authoritative but approachable. Mentor energy.",
    visual_direction: "Professional setting, stable shot, confident posture"
  },
  PODCAST: {
    hook_formula: "Hot take or opinion that demands response",
    pacing: "Conversational, natural pauses for emphasis",
    structure: ["[0-2s] Bold hot take", "[2-10s] Your reasoning", "[10-18s] Evidence/example", "[18-22s] Challenge to viewer"],
    tone: "Opinionated but not aggressive. Inviting debate.",
    visual_direction: "Talking head, expressive, could be split-screen"
  },
  DISCOVERY: {
    hook_formula: "Curiosity gap - 'I just found out...'",
    pacing: "Building excitement. Start curious, end amazed.",
    structure: ["[0-2s] Curiosity hook", "[2-8s] Discovery context", "[8-15s] The reveal", "[15-20s] Why it matters"],
    tone: "Genuinely surprised, sharing something exciting.",
    visual_direction: "Casual setting, authentic reactions, natural lighting"
  },
  CAMERA_PUT_DOWN: {
    hook_formula: "Mid-sentence start, already in motion",
    pacing: "Fast, urgent, no filler. Get to point immediately.",
    structure: ["[0-1s] Already mid-thought", "[1-8s] The point directly", "[8-12s] Quick proof", "[12-15s] Rapid CTA"],
    tone: "Urgent, casual, caught-in-the-moment.",
    visual_direction: "Handheld shake, messy authentic environment"
  },
  SENSORY: {
    hook_formula: "Visual intrigue - 'Watch this...'",
    pacing: "Slow, deliberate, ASMR-like. Let visuals breathe.",
    structure: ["[0-3s] Visual hook", "[3-12s] Slow reveal", "[12-18s] Peak satisfaction", "[18-22s] Soft close"],
    tone: "Calm, meditative. Let visuals do the work.",
    visual_direction: "Extreme close-ups, textures, macro-style"
  },
  DELAYED_GRATIFICATION: {
    hook_formula: "Tease the payoff - 'Wait for it...'",
    pacing: "Tension building. Each beat raises stakes.",
    structure: ["[0-3s] Tease payoff", "[3-10s] Setup/before state", "[10-18s] Building tension", "[18-25s] The reveal"],
    tone: "Building anticipation. Make them NEED to see end.",
    visual_direction: "Dynamic, before/after framing, cinematic reveal"
  }
};

/**
 * Smart AUTO detection - analyzes user prompt to pick the best method
 * Scores each method based on keyword/intent matches
 */
function detectMethodFromPrompt(intentText: string): string {
  const text = intentText.toLowerCase();
  const scores: Record<string, number> = {};
  
  for (const [method, patterns] of Object.entries(METHOD_DETECTION_PATTERNS)) {
    scores[method] = 0;
    
    // Keyword matches (higher weight)
    for (const keyword of patterns.keywords) {
      if (text.includes(keyword)) {
        scores[method] += 2;
      }
    }
    
    // Intent matches (lower weight)
    for (const intent of patterns.intent) {
      if (text.includes(intent)) {
        scores[method] += 1;
      }
    }
  }
  
  // Find highest scoring method
  const entries = Object.entries(scores);
  const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a), entries[0]);
  
  // If no strong match, default to FOUNDERS (most versatile)
  return best[1] > 0 ? best[0] : "FOUNDERS";
}

/**
 * Build structured JSON prompt for better worker communication
 * Converts user's raw input into clear, organized instructions
 */
function buildStructuredPrompt(
  intentText: string,
  method: string,
  mode: string,
  variantIndex: number,
  batchSize: number
): object {
  const config = METHOD_CONFIGS[method] || METHOD_CONFIGS.FOUNDERS;
  
  return {
    // User's original input
    raw_intent: intentText,
    
    // Parsed topic (could be enhanced with NLP later)
    topic: intentText.trim(),
    
    // Detected or selected method
    method: method,
    
    // Method-specific guidance
    method_config: config,
    
    // Generation context
    context: {
      variant_number: variantIndex + 1,
      total_variants: batchSize,
      test_mode: mode,
      target_duration_sec: 20 // Default target
    }
  };
}

/**
 * Smart AUTO preset resolver - picks best method for video/image
 */
function resolvePreset(intentText: string, requestedPreset: string, outputType: OutputType): string {
  // If user selected a specific method, use it
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
  
  // For videos, use smart method detection
  return detectMethodFromPrompt(intentText);
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
      // NEW FLOW: Start with RESEARCH job (Claude brain + Apify scraping)
      // research → compile → tts → video → assemble
      
      // Build structured prompt for better worker communication
      const structuredPrompt = buildStructuredPrompt(
        intent_text,
        resolvedPreset,
        mode,
        0, // Will be updated per variant in worker
        batch_size
      );
      
      // Check if research is enabled (Apify token present)
      const researchEnabled = Deno.env.get("APIFY_API_TOKEN") || Deno.env.get("ANTHROPIC_API_KEY");
      
      // Job type: research first if enabled, otherwise skip to compile
      const initialJobType = researchEnabled ? "research" : (output_type === "image" ? "image_compile" : "compile");
      
      const { error: jobError } = await supabase
        .from("jobs")
        .insert({
          batch_id: batch.id,
          clip_id: null,
          type: initialJobType,
          status: "queued",
          payload_json: { 
            intent_text, 
            preset_key: resolvedPreset, 
            mode,
            output_type,
            image_type,
            aspect_ratio,
            image_pack,
            // Structured prompt for worker
            structured_prompt: structuredPrompt,
          },
        });
      if (jobError) throw new Error(`Failed to create job: ${jobError.message}`);
      
      console.log(`Created ${initialJobType} job for batch ${batch.id}`);
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
