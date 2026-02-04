// FEEDR Terminal - Generate Batch Edge Function
// POST /functions/v1/generate-batch

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateBatchRequest {
  intent_text: string;
  preset_key: string;
  mode: "hook_test" | "angle_test" | "format_test";
  batch_size: 5 | 10 | 15;
}

// Simple AUTO preset resolver
function resolvePreset(intentText: string, requestedPreset: string): string {
  if (requestedPreset !== "AUTO") {
    return requestedPreset;
  }

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
    const { intent_text, preset_key, mode, batch_size } = body;

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

    // Resolve preset for AUTO
    const resolvedPreset = resolvePreset(intent_text, preset_key);

    // 1. Create batch row
    const { data: batch, error: batchError } = await supabase
      .from("batches")
      .insert({
        intent_text,
        preset_key,
        mode,
        batch_size,
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

    // 3. Create clip rows
    const clipsToInsert = [];
    for (let i = 0; i < batch_size; i++) {
      clipsToInsert.push({
        batch_id: batch.id,
        variant_id: formatVariantId(i),
        segment_type: "single",
        status: "planned",
        preset_key: resolvedPreset,
        winner: false,
        killed: false,
      });
    }

    const { error: clipsError } = await supabase
      .from("clips")
      .insert(clipsToInsert);

    if (clipsError) {
      throw new Error(`Failed to create clips: ${clipsError.message}`);
    }

    // 4. Enqueue compile job
    const { error: jobError } = await supabase
      .from("jobs")
      .insert({
        batch_id: batch.id,
        clip_id: null,
        type: "compile",
        status: "queued",
        payload_json: { intent_text, preset_key: resolvedPreset, mode },
      });

    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`);
    }

    // Return batch_id
    return new Response(
      JSON.stringify({ batch_id: batch.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-batch:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
