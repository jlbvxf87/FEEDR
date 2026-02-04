// FEEDR - Main Feed Endpoint (OpenClaw Orchestrated)
// This is the primary endpoint that receives user input and intelligently executes

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { OpenClawOrchestrator } from "../_shared/services/orchestrator/openclaw.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FeedRequest {
  input: string;  // Raw user input like "Jordan 4s viral video"
  user_id?: string;
  
  // Optional overrides (if user explicitly chose)
  output_type?: "video" | "image";
  preset_key?: string;
  image_pack?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get request body
    const body: FeedRequest = await req.json();
    
    if (!body.input?.trim()) {
      return new Response(
        JSON.stringify({ error: "Input is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    let user_id = body.user_id;
    
    if (authHeader && !user_id) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      user_id = user?.id;
    }

    // Initialize OpenClaw orchestrator
    const openclaw = new OpenClawOrchestrator();

    // Step 1: Parse user's intent
    console.log(`OpenClaw: Parsing intent for: "${body.input}"`);
    const intent = await openclaw.parseIntent({
      raw_input: body.input,
      user_id: user_id || "anonymous",
    });
    
    console.log(`OpenClaw: Parsed intent:`, JSON.stringify(intent, null, 2));

    // Apply any explicit overrides from user
    if (body.output_type) intent.output_type = body.output_type;
    if (body.preset_key) intent.recommended_preset = body.preset_key;
    if (body.image_pack) intent.image_pack = body.image_pack;

    // Step 2: Get learning context (what has worked for this user)
    const learningContext = await openclaw.getLearningContext(user_id || "anonymous");
    console.log(`OpenClaw: Learning context - ${Object.keys(learningContext.winner_patterns.preferred_presets).length} preset preferences, ${learningContext.trending_hooks.length} trending hooks`);

    // Step 3: Create execution plan
    const plan = await openclaw.createPlan(intent, learningContext);
    console.log(`OpenClaw: Created plan with ${plan.steps.length} steps, ~${plan.estimated_duration_seconds}s, ~$${(plan.estimated_cost_cents / 100).toFixed(2)}`);

    // Step 4: Execute the plan
    const result = await openclaw.execute(plan);
    console.log(`OpenClaw: Execution complete, batch_id: ${result.batch_id}`);

    // Return result with metadata
    return new Response(
      JSON.stringify({
        batch_id: result.batch_id,
        intent: {
          output_type: intent.output_type,
          content_type: intent.content_type,
          preset: intent.recommended_preset,
          confidence: intent.confidence,
          reasoning: intent.reasoning,
          needs_research: intent.needs_research,
        },
        plan: {
          steps: plan.steps.length,
          estimated_duration_seconds: plan.estimated_duration_seconds,
          estimated_cost_cents: plan.estimated_cost_cents,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("OpenClaw Error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to process request",
        details: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
