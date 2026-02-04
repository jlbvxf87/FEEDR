// FEEDR - OpenClaw Orchestrator Implementation
// The intelligent brain powered by Claude

import {
  OrchestratorService,
  UserIntent,
  ParsedIntent,
  LearningContext,
  ExecutionPlan,
  INTENT_PARSING_PROMPT,
  LEARNING_PROMPT,
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
    
    if (!this.apiKey) {
      console.warn("OpenClaw: No ANTHROPIC_API_KEY, will use fallback logic");
    }
  }

  async parseIntent(input: UserIntent): Promise<ParsedIntent> {
    // If no API key, use rule-based fallback
    if (!this.apiKey) {
      return this.parseIntentFallback(input);
    }

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
        messages: [
          {
            role: "user",
            content: `Parse this user input and return JSON:

User input: "${input.raw_input}"

Return a JSON object with these fields:
- output_type: "video" or "image"
- content_type: "product" | "lifestyle" | "viral" | "educational" | "ad" | "ugc"
- product_name: extracted product name or null
- brand: extracted brand or null
- target_audience: inferred audience or null
- tone: "professional" | "casual" | "funny" | "dramatic" | "inspiring"
- recommended_preset: best preset key
- recommended_batch_size: 3 for testing, 5 for production
- image_pack: if image, which pack ("auto" | "product" | "lifestyle" | "ads" | "social")
- aspect_ratio: "9:16" for video, "1:1" or "4:5" for image
- needs_research: boolean - should we scrape TikTok first?
- research_query: if needs_research, what to search
- confidence: 0-1 how confident you are
- reasoning: brief explanation of your decisions`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("OpenClaw intent parsing failed, using fallback");
      return this.parseIntentFallback(input);
    }

    const data = await response.json();
    const content = data.content[0]?.text || "";
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return this.parseIntentFallback(input);
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        output_type: parsed.output_type || "video",
        content_type: parsed.content_type || "viral",
        product_name: parsed.product_name,
        brand: parsed.brand,
        target_audience: parsed.target_audience,
        tone: parsed.tone || "casual",
        recommended_preset: parsed.recommended_preset || "VIRAL_HOOK",
        recommended_batch_size: parsed.recommended_batch_size || 3,
        image_pack: parsed.image_pack,
        aspect_ratio: parsed.aspect_ratio || "9:16",
        needs_research: parsed.needs_research || false,
        research_query: parsed.research_query,
        confidence: parsed.confidence || 0.7,
        reasoning: parsed.reasoning || "AI-parsed intent",
      };
    } catch {
      return this.parseIntentFallback(input);
    }
  }

  private parseIntentFallback(input: UserIntent): ParsedIntent {
    const text = input.raw_input.toLowerCase();
    
    // Determine output type
    const isImage = /photo|image|picture|shot|lifestyle shot|product shot/.test(text);
    const output_type = isImage ? "image" : "video";
    
    // Determine content type
    let content_type: ParsedIntent["content_type"] = "viral";
    if (/product|showcase|demo/.test(text)) content_type = "product";
    if (/lifestyle|aesthetic|vibe/.test(text)) content_type = "lifestyle";
    if (/ad|advertis|promo/.test(text)) content_type = "ad";
    if (/ugc|authentic|real/.test(text)) content_type = "ugc";
    if (/teach|how to|explain|tutorial/.test(text)) content_type = "educational";
    
    // Determine preset
    let recommended_preset = output_type === "video" ? "VIRAL_HOOK" : "PRODUCT_CLEAN";
    if (content_type === "product") recommended_preset = output_type === "video" ? "PRODUCT" : "PRODUCT_CLEAN";
    if (content_type === "lifestyle") recommended_preset = output_type === "video" ? "TRENDING_SOUND" : "PRODUCT_LIFESTYLE";
    if (content_type === "ad") recommended_preset = output_type === "video" ? "VIRAL_HOOK" : "AD_BOLD";
    if (content_type === "ugc") recommended_preset = output_type === "video" ? "TALKING_HEAD" : "UGC_AUTHENTIC";
    
    // Needs research?
    const needs_research = /trend|viral|popular|what.?s working|hook/.test(text);
    
    // Image pack
    let image_pack = "auto";
    if (content_type === "product") image_pack = "product";
    if (content_type === "lifestyle") image_pack = "lifestyle";
    if (content_type === "ad") image_pack = "ads";
    
    return {
      output_type,
      content_type,
      product_name: undefined, // Would need NER for this
      brand: undefined,
      target_audience: undefined,
      tone: "casual",
      recommended_preset,
      recommended_batch_size: 3,
      image_pack,
      aspect_ratio: output_type === "video" ? "9:16" : "1:1",
      needs_research,
      research_query: needs_research ? input.raw_input : undefined,
      confidence: 0.5,
      reasoning: "Rule-based fallback parsing",
    };
  }

  async getLearningContext(user_id: string): Promise<LearningContext> {
    // Default context
    const defaultContext: LearningContext = {
      winner_patterns: {
        preferred_presets: {},
        preferred_hooks: [],
        preferred_tones: [],
        avg_script_length: 150,
      },
      trending_hooks: [],
      trending_styles: [],
    };

    if (!this.supabaseUrl || !this.supabaseKey) {
      return defaultContext;
    }

    try {
      // Fetch user's past winners
      const winnersResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/clips?user_id=eq.${user_id}&is_winner=eq.true&select=*,batches(preset_key)&order=created_at.desc&limit=50`,
        {
          headers: {
            "apikey": this.supabaseKey,
            "Authorization": `Bearer ${this.supabaseKey}`,
          },
        }
      );

      if (!winnersResponse.ok) {
        return defaultContext;
      }

      const winners = await winnersResponse.json();
      
      // Analyze patterns
      const presetCounts: Record<string, number> = {};
      const hooks: string[] = [];
      let totalScriptLength = 0;
      
      for (const winner of winners) {
        const preset = winner.batches?.preset_key;
        if (preset) {
          presetCounts[preset] = (presetCounts[preset] || 0) + 1;
        }
        
        // Extract hook from script (first sentence)
        if (winner.script_spoken) {
          const hook = winner.script_spoken.split(/[.!?]/)[0];
          if (hook) hooks.push(hook);
          totalScriptLength += winner.script_spoken.length;
        }
      }

      // Fetch recent research trends
      const researchResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/research_queries?user_id=eq.${user_id}&status=eq.completed&select=result_json&order=created_at.desc&limit=5`,
        {
          headers: {
            "apikey": this.supabaseKey,
            "Authorization": `Bearer ${this.supabaseKey}`,
          },
        }
      );

      let trendingHooks: string[] = [];
      if (researchResponse.ok) {
        const research = await researchResponse.json();
        for (const r of research) {
          if (r.result_json?.recommended_hooks) {
            trendingHooks.push(...r.result_json.recommended_hooks);
          }
        }
      }

      return {
        winner_patterns: {
          preferred_presets: presetCounts,
          preferred_hooks: hooks.slice(0, 10),
          preferred_tones: [], // Would need sentiment analysis
          avg_script_length: winners.length > 0 ? totalScriptLength / winners.length : 150,
        },
        trending_hooks: [...new Set(trendingHooks)].slice(0, 10),
        trending_styles: [],
      };
    } catch (error) {
      console.error("OpenClaw: Error fetching learning context:", error);
      return defaultContext;
    }
  }

  async createPlan(intent: ParsedIntent, context: LearningContext): Promise<ExecutionPlan> {
    const steps: ExecutionPlan["steps"] = [];
    let totalDuration = 0;
    let totalCost = 0;

    // Step 1: Research if needed
    if (intent.needs_research) {
      steps.push({
        type: "research",
        params: {
          query: intent.research_query || intent.product_name || "trending content",
          niche: intent.content_type,
        },
      });
      totalDuration += 30; // ~30 seconds for research
      totalCost += 50; // ~$0.50 for Apify + Claude analysis
    }

    // Step 2: Generate batch
    // Enhance the intent with learning context
    let enhancedPreset = intent.recommended_preset;
    
    // If user has strong preference for a preset, use it
    const presetPrefs = context.winner_patterns.preferred_presets;
    const topPreset = Object.entries(presetPrefs)
      .sort(([, a], [, b]) => b - a)[0];
    
    if (topPreset && topPreset[1] >= 3) {
      // User has picked this preset as winner 3+ times
      enhancedPreset = topPreset[0];
    }

    steps.push({
      type: "generate_batch",
      params: {
        intent_text: this.enhancePrompt(intent, context),
        preset_key: enhancedPreset,
        output_type: intent.output_type,
        batch_size: intent.recommended_batch_size,
        image_pack: intent.image_pack,
        aspect_ratio: intent.aspect_ratio,
      },
      depends_on: intent.needs_research ? ["research"] : undefined,
    });

    // Estimate duration and cost based on output type
    if (intent.output_type === "video") {
      totalDuration += 120; // ~2 minutes for video pipeline
      totalCost += 200; // ~$2 for full video generation
    } else {
      totalDuration += 30; // ~30 seconds for images
      totalCost += 50; // ~$0.50 for images
    }

    return {
      steps,
      estimated_duration_seconds: totalDuration,
      estimated_cost_cents: totalCost,
    };
  }

  private enhancePrompt(intent: ParsedIntent, context: LearningContext): string {
    let enhanced = intent.product_name || "";
    
    // Add trending hooks if available
    if (context.trending_hooks.length > 0 && intent.content_type === "viral") {
      const randomHook = context.trending_hooks[Math.floor(Math.random() * context.trending_hooks.length)];
      enhanced = `${enhanced}. Use a hook style like: "${randomHook}"`;
    }
    
    // Add user's preferred patterns
    if (context.winner_patterns.preferred_hooks.length > 0) {
      const preferredStyle = context.winner_patterns.preferred_hooks[0];
      enhanced = `${enhanced}. User prefers hooks like: "${preferredStyle}"`;
    }
    
    return enhanced || intent.product_name || "engaging content";
  }

  async execute(plan: ExecutionPlan): Promise<{ batch_id: string }> {
    let researchResult: any = null;
    let batch_id = "";

    for (const step of plan.steps) {
      switch (step.type) {
        case "research":
          // Call research function
          const researchResponse = await fetch(
            `${this.supabaseUrl}/functions/v1/research`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.supabaseKey}`,
              },
              body: JSON.stringify({
                query: step.params.query,
                niche: step.params.niche,
              }),
            }
          );
          
          if (researchResponse.ok) {
            researchResult = await researchResponse.json();
          }
          break;

        case "generate_batch":
          // Enhance params with research results
          const batchParams = { ...step.params };
          
          if (researchResult?.recommended_hooks?.length > 0) {
            // Inject trending hooks into the intent
            batchParams.intent_text = `${batchParams.intent_text}. 
              Trending hooks to consider: ${researchResult.recommended_hooks.slice(0, 3).join(", ")}`;
          }

          // Call generate-batch function
          const batchResponse = await fetch(
            `${this.supabaseUrl}/functions/v1/generate-batch`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.supabaseKey}`,
              },
              body: JSON.stringify(batchParams),
            }
          );

          if (!batchResponse.ok) {
            throw new Error(`Failed to generate batch: ${await batchResponse.text()}`);
          }

          const batchData = await batchResponse.json();
          batch_id = batchData.batch_id;
          break;
      }
    }

    return { batch_id };
  }

  async recordWinner(batch_id: string, winning_clip_id: string): Promise<void> {
    if (!this.supabaseUrl || !this.supabaseKey) return;

    // Mark the clip as winner
    await fetch(
      `${this.supabaseUrl}/rest/v1/clips?id=eq.${winning_clip_id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": this.supabaseKey,
          "Authorization": `Bearer ${this.supabaseKey}`,
        },
        body: JSON.stringify({ is_winner: true }),
      }
    );

    // Update batch
    await fetch(
      `${this.supabaseUrl}/rest/v1/batches?id=eq.${batch_id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": this.supabaseKey,
          "Authorization": `Bearer ${this.supabaseKey}`,
        },
        body: JSON.stringify({ 
          winner_clip_id: winning_clip_id,
          status: "completed",
        }),
      }
    );

    // Log for learning (could trigger async learning job)
    console.log(`OpenClaw: Recorded winner ${winning_clip_id} for batch ${batch_id}`);
  }
}
