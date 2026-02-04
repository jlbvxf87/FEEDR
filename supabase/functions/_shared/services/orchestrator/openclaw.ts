// FEEDR - Smart Orchestrator (Claude-powered brain)
// With cost optimization and smart model routing

import {
  OrchestratorService,
  UserIntent,
  ParsedIntent,
  LearningContext,
  ExecutionPlan,
  INTENT_PARSING_PROMPT,
} from "./interface.ts";
import { QualityMode, QUALITY_TIERS, analyzeComplexity, estimateCost } from "../costs.ts";

export class FeedrBrain implements OrchestratorService {
  readonly name = "feedr-brain";
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

  /**
   * Get optimal model configuration based on quality mode
   */
  getModelConfig(mode: QualityMode = "good") {
    return QUALITY_TIERS[mode];
  }

  /**
   * Smart model selection based on prompt complexity
   */
  selectQualityMode(prompt: string, userPreference?: QualityMode): {
    mode: QualityMode;
    config: typeof QUALITY_TIERS.good;
    reason: string;
    estimatedCostCents: number;
  } {
    // If user explicitly chose a mode, use it
    if (userPreference) {
      const config = QUALITY_TIERS[userPreference];
      return {
        mode: userPreference,
        config,
        reason: `User selected ${userPreference} mode`,
        estimatedCostCents: 0, // Will be calculated later
      };
    }

    // Otherwise, analyze complexity and suggest
    const analysis = analyzeComplexity(prompt);
    const config = QUALITY_TIERS[analysis.suggestedMode];
    
    return {
      mode: analysis.suggestedMode,
      config,
      reason: analysis.reason,
      estimatedCostCents: 0,
    };
  }

  async parseIntent(input: UserIntent): Promise<ParsedIntent> {
    // Determine quality mode
    const qualitySelection = this.selectQualityMode(
      input.raw_input,
      input.quality_mode as QualityMode | undefined
    );
    
    // Use appropriate model based on quality mode
    const parseModel = qualitySelection.mode === "fast" 
      ? "claude-3-haiku-20240307"
      : qualitySelection.mode === "good"
        ? "claude-3-5-haiku-20241022"
        : this.model;

    if (!this.apiKey) {
      return this.parseIntentFallback(input, qualitySelection.mode);
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
          model: parseModel,
          max_tokens: 1024,
          system: INTENT_PARSING_PROMPT,
          messages: [{
            role: "user",
            content: `Parse: "${input.raw_input}". Quality mode: ${qualitySelection.mode}. Return JSON with output_type, content_type, recommended_preset, needs_research, confidence, reasoning.`,
          }],
        }),
      });

      if (!response.ok) {
        console.error("API error:", await response.text());
        return this.parseIntentFallback(input, qualitySelection.mode);
      }

      const data = await response.json();
      const content = data.content[0]?.text || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const outputType = parsed.output_type || "video";
        const batchSize = outputType === "video" ? 4 : 4; // Default middle batch sizes
        
        // Calculate estimated cost
        const estimatedCost = estimateCost(qualitySelection.mode, outputType, batchSize);
        
        return {
          output_type: outputType,
          content_type: parsed.content_type || "viral",
          product_name: parsed.product_name,
          recommended_preset: parsed.recommended_preset || "AUTO",
          recommended_batch_size: batchSize,
          image_pack: parsed.image_pack,
          aspect_ratio: parsed.aspect_ratio || "9:16",
          needs_research: parsed.needs_research || false,
          research_query: parsed.research_query,
          confidence: parsed.confidence || 0.7,
          reasoning: parsed.reasoning || "AI-parsed intent",
          quality_mode: qualitySelection.mode,
          model_config: qualitySelection.config,
          estimated_cost_cents: estimatedCost,
        };
      }
    } catch (e) {
      console.error("FeedrBrain parse error:", e);
    }
    
    return this.parseIntentFallback(input, qualitySelection.mode);
  }

  private parseIntentFallback(input: UserIntent, qualityMode: QualityMode): ParsedIntent {
    const text = input.raw_input.toLowerCase();
    const isImage = /photo|image|picture|shot/.test(text);
    const isViral = /viral|trending|hook/.test(text);
    const outputType = isImage ? "image" : "video";
    const batchSize = isImage ? 4 : 4; // Default middle batch sizes
    
    return {
      output_type: outputType,
      content_type: isViral ? "viral" : "product",
      recommended_preset: isImage ? "PRODUCT_CLEAN" : (isViral ? "HOOK_V1" : "AUTO"),
      recommended_batch_size: batchSize,
      aspect_ratio: isImage ? "1:1" : "9:16",
      needs_research: isViral,
      confidence: 0.5,
      reasoning: "Rule-based fallback",
      quality_mode: qualityMode,
      model_config: QUALITY_TIERS[qualityMode],
      estimated_cost_cents: estimateCost(qualityMode, outputType, batchSize),
    };
  }

  async getLearningContext(user_id: string): Promise<LearningContext> {
    // Try to fetch user preferences from database
    if (this.supabaseUrl && this.supabaseKey) {
      try {
        const response = await fetch(
          `${this.supabaseUrl}/rest/v1/user_preferences?user_id=eq.${user_id}`,
          {
            headers: {
              "apikey": this.supabaseKey,
              "Authorization": `Bearer ${this.supabaseKey}`,
            },
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.length > 0) {
            const prefs = data[0];
            return {
              winner_patterns: {
                preferred_presets: prefs.preferred_presets || {},
                preferred_hooks: prefs.preferred_hooks || [],
                preferred_tones: prefs.preferred_tones || [],
                avg_script_length: prefs.avg_script_length || 150,
              },
              trending_hooks: [],
              trending_styles: [],
            };
          }
        }
      } catch (e) {
        console.error("Error fetching learning context:", e);
      }
    }
    
    return {
      winner_patterns: { preferred_presets: {}, preferred_hooks: [], preferred_tones: [], avg_script_length: 150 },
      trending_hooks: [],
      trending_styles: [],
    };
  }

  async createPlan(intent: ParsedIntent, context: LearningContext): Promise<ExecutionPlan> {
    const steps: ExecutionPlan["steps"] = [];
    let duration = 0;
    let cost = intent.estimated_cost_cents || 0;

    if (intent.needs_research) {
      steps.push({ 
        type: "research", 
        params: { query: intent.research_query || intent.product_name } 
      });
      duration += 30;
      cost += 50; // Research cost
    }

    steps.push({
      type: "generate_batch",
      params: {
        intent_text: intent.product_name || "",
        preset_key: intent.recommended_preset,
        output_type: intent.output_type,
        batch_size: intent.recommended_batch_size,
        image_pack: intent.image_pack,
        quality_mode: intent.quality_mode,
        model_config: intent.model_config,
      },
    });

    duration += intent.output_type === "video" ? 120 : 30;

    return { 
      steps, 
      estimated_duration_seconds: duration, 
      estimated_cost_cents: cost,
      quality_mode: intent.quality_mode,
    };
  }

  async execute(plan: ExecutionPlan): Promise<{ batch_id: string; quality_mode?: string }> {
    let batch_id = "";

    for (const step of plan.steps) {
      if (step.type === "research") {
        try {
          await fetch(`${this.supabaseUrl}/functions/v1/research`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${this.supabaseKey}`,
            },
            body: JSON.stringify(step.params),
          });
        } catch (e) {
          console.error("Research error:", e);
        }
      }
      
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
        } else {
          console.error("Generate batch error:", await response.text());
        }
      }
    }

    return { batch_id, quality_mode: plan.quality_mode };
  }
}
