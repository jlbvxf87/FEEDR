// FEEDR - OpenClaw Orchestrator Implementation

import {
  OrchestratorService,
  UserIntent,
  ParsedIntent,
  LearningContext,
  ExecutionPlan,
  INTENT_PARSING_PROMPT,
} from "./interface.ts";

export class OpenClawOrchestrator implements OrchestratorService {
  readonly name = "openclaw";
  private apiKey: string;
  private model: string;
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor() {
    this.apiKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
    this.model = Deno.env.get("OPENCLAW_MODEL") || "claude-sonnet-4-20250514";
    this.supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    this.supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  }

  async parseIntent(input: UserIntent): Promise<ParsedIntent> {
    if (!this.apiKey) {
      return this.parseIntentFallback(input);
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1024,
          system: INTENT_PARSING_PROMPT,
          messages: [{
            role: "user",
            content: `Parse: "${input.raw_input}". Return JSON with output_type, content_type, recommended_preset, needs_research, confidence, reasoning.`,
          }],
        }),
      });

      if (!response.ok) {
        return this.parseIntentFallback(input);
      }

      const data = await response.json();
      const content = data.content[0]?.text || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          output_type: parsed.output_type || "video",
          content_type: parsed.content_type || "viral",
          product_name: parsed.product_name,
          recommended_preset: parsed.recommended_preset || "AUTO",
          recommended_batch_size: 3,
          image_pack: parsed.image_pack,
          aspect_ratio: parsed.aspect_ratio || "9:16",
          needs_research: parsed.needs_research || false,
          research_query: parsed.research_query,
          confidence: parsed.confidence || 0.7,
          reasoning: parsed.reasoning || "AI-parsed intent",
        };
      }
    } catch (e) {
      console.error("OpenClaw parse error:", e);
    }
    
    return this.parseIntentFallback(input);
  }

  private parseIntentFallback(input: UserIntent): ParsedIntent {
    const text = input.raw_input.toLowerCase();
    const isImage = /photo|image|picture|shot/.test(text);
    const isViral = /viral|trending|hook/.test(text);
    
    return {
      output_type: isImage ? "image" : "video",
      content_type: isViral ? "viral" : "product",
      recommended_preset: isImage ? "PRODUCT_CLEAN" : (isViral ? "HOOK_V1" : "AUTO"),
      recommended_batch_size: 3,
      aspect_ratio: isImage ? "1:1" : "9:16",
      needs_research: isViral,
      confidence: 0.5,
      reasoning: "Rule-based fallback",
    };
  }

  async getLearningContext(user_id: string): Promise<LearningContext> {
    return {
      winner_patterns: { preferred_presets: {}, preferred_hooks: [], preferred_tones: [], avg_script_length: 150 },
      trending_hooks: [],
      trending_styles: [],
    };
  }

  async createPlan(intent: ParsedIntent, context: LearningContext): Promise<ExecutionPlan> {
    const steps: ExecutionPlan["steps"] = [];
    let duration = 0, cost = 0;

    if (intent.needs_research) {
      steps.push({ type: "research", params: { query: intent.research_query || intent.product_name } });
      duration += 30;
      cost += 50;
    }

    steps.push({
      type: "generate_batch",
      params: {
        intent_text: intent.product_name || "",
        preset_key: intent.recommended_preset,
        output_type: intent.output_type,
        batch_size: intent.recommended_batch_size,
        image_pack: intent.image_pack,
      },
    });

    duration += intent.output_type === "video" ? 120 : 30;
    cost += intent.output_type === "video" ? 200 : 50;

    return { steps, estimated_duration_seconds: duration, estimated_cost_cents: cost };
  }

  async execute(plan: ExecutionPlan): Promise<{ batch_id: string }> {
    let batch_id = "";

    for (const step of plan.steps) {
      if (step.type === "generate_batch") {
        const response = await fetch(`${this.supabaseUrl}/functions/v1/generate-batch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.supabaseKey}`,
          },
          body: JSON.stringify(step.params),
        });

        if (response.ok) {
          const data = await response.json();
          batch_id = data.batch_id;
        }
      }
    }

    return { batch_id };
  }
}
