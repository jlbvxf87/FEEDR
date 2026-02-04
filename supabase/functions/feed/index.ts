// FEEDR - Main Feed Endpoint (OpenClaw Orchestrated)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { OpenClawOrchestrator } from "../_shared/services/orchestrator/openclaw.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    
    if (!body.input?.trim()) {
      return new Response(JSON.stringify({ error: "Input required" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const authHeader = req.headers.get("Authorization");
    let user_id = body.user_id;
    
    if (authHeader && !user_id) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      user_id = user?.id;
    }

    const openclaw = new OpenClawOrchestrator();

    // Parse intent
    const intent = await openclaw.parseIntent({
      raw_input: body.input,
      user_id: user_id || "anonymous",
    });

    // Apply overrides
    if (body.output_type) intent.output_type = body.output_type;
    if (body.preset_key) intent.recommended_preset = body.preset_key;
    if (body.image_pack) intent.image_pack = body.image_pack;

    // Get learning context & create plan
    const context = await openclaw.getLearningContext(user_id || "anonymous");
    const plan = await openclaw.createPlan(intent, context);

    // Execute
    const result = await openclaw.execute(plan);

    return new Response(JSON.stringify({
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
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Feed error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
