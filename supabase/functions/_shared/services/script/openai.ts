// FEEDR - OpenAI Script Service
// Uses GPT-4 for script generation with method-aware prompts

import { 
  ScriptService, 
  ScriptOutput, 
  ScriptGenerationParams,
  SCRIPT_SYSTEM_PROMPT,
  METHOD_SCRIPT_PROMPTS,
  METHOD_VISUAL_PROMPTS,
} from "./interface.ts";
import {
  getScriptPromptConstraints,
  validateScriptTiming,
  validateOverlayTiming,
  SCRIPT_CONSTRAINTS,
  VIDEO_DURATION,
} from "../../timing.ts";
import { validateSoraPrompt, enhanceSoraPrompt } from "../../quality.ts";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

export class OpenAIScriptService implements ScriptService {
  readonly name = "openai";
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = Deno.env.get("OPENAI_API_KEY") || "";
    this.model = Deno.env.get("OPENAI_MODEL") || "gpt-4-turbo-preview";
    
    if (!this.apiKey) {
      console.warn("OPENAI_API_KEY not set, OpenAI service will fail");
    }
  }

  async generateScript(params: ScriptGenerationParams): Promise<ScriptOutput> {
    const { intent_text, preset_key, mode, variant_index, batch_size, structured_prompt, research_context } = params;
    
    // Get method-specific prompts (fallback to FOUNDERS as default)
    const methodPrompt = METHOD_SCRIPT_PROMPTS[preset_key] || METHOD_SCRIPT_PROMPTS.FOUNDERS;
    const visualPrompt = METHOD_VISUAL_PROMPTS[preset_key] || METHOD_VISUAL_PROMPTS.FOUNDERS;
    
    // Build research section if available
    let researchSection = "";
    if (research_context?.research_summary) {
      researchSection = `
═══════════════════════════════════════════════════════════════
🔬 RESEARCH INSIGHTS (from ${research_context.scraped_videos?.length || 0} viral examples):
═══════════════════════════════════════════════════════════════
${research_context.research_summary}

IMPORTANT: Use these real patterns and hooks as inspiration. The top performers in this niche are using these exact approaches.
═══════════════════════════════════════════════════════════════
`;
    }
    
    // Get timing constraints
    const timingConstraints = getScriptPromptConstraints();
    
    // Build the user prompt with rich method guidance + research
    const userPrompt = `Generate variant ${variant_index + 1} of ${batch_size} for a short-form video.

═══════════════════════════════════════════════════════════════
USER'S TOPIC/INTENT:
${intent_text}
═══════════════════════════════════════════════════════════════
${researchSection}
${timingConstraints}

${methodPrompt}

═══════════════════════════════════════════════════════════════
VISUAL DIRECTION FOR VIDEO:
${visualPrompt}
═══════════════════════════════════════════════════════════════

VARIANT REQUIREMENTS:
- This is variant ${variant_index + 1} of ${batch_size} - make it DISTINCTLY different
- Use a unique hook approach that still follows the method's formula
${research_context?.trend_analysis?.recommended_hooks ? `- Consider these proven hook styles from research: ${research_context.trend_analysis.recommended_hooks.slice(0, 2).map(h => `"${h.hook}"`).join(", ")}` : ''}
- Test mode: ${mode}
- SCRIPT MUST BE 30-38 WORDS (count them!)
- Include 4-5 on-screen text overlays (timestamps 0-12 seconds only)

${structured_prompt ? `
STRUCTURED CONTEXT (JSON):
${JSON.stringify(structured_prompt, null, 2)}
` : ''}

Return ONLY valid JSON:
{
  "script_spoken": "The exact script - MUST be 30-38 words (count carefully!)",
  "on_screen_text_json": [
    {"t": 0, "text": "BOLD HOOK TEXT"},
    {"t": 3, "text": "Key point"},
    {"t": 6, "text": "Support"},
    {"t": 9, "text": "Value"},
    {"t": 12, "text": "CTA"}
  ],
  "sora_prompt": "Detailed visual description incorporating the visual direction above"
}`;

    try {
      const response = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: SCRIPT_SYSTEM_PROMPT },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.85, // Slightly higher for more varied hooks
          max_tokens: 1200,
          response_format: { type: "json_object" }
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error("No content in OpenAI response");
      }

      const parsed = JSON.parse(content) as ScriptOutput;
      
      // Validate output structure
      if (!parsed.script_spoken || !parsed.on_screen_text_json || !parsed.sora_prompt) {
        throw new Error("Invalid response structure from OpenAI");
      }

      // Validate and log timing
      const timing = validateScriptTiming(parsed.script_spoken);
      console.log(`[Script] Word count: ${timing.wordCount}, Est. duration: ${timing.estimatedDuration}s`);
      
      if (!timing.isValid) {
        console.warn(`[Script] Timing issues: ${timing.issues.join(", ")}`);
        // If script is too long, truncate to safe word count
        if (timing.wordCount > SCRIPT_CONSTRAINTS.MAX_WORDS) {
          const words = parsed.script_spoken.split(/\s+/);
          const truncated = words.slice(0, SCRIPT_CONSTRAINTS.TARGET_WORDS).join(" ");
          console.log(`[Script] Truncated from ${timing.wordCount} to ${SCRIPT_CONSTRAINTS.TARGET_WORDS} words`);
          parsed.script_spoken = truncated + "...";
        }
      }

      // Validate and adjust overlay timing to fit within video duration
      const adjustedOverlays = validateOverlayTiming(
        parsed.on_screen_text_json, 
        VIDEO_DURATION.TARGET
      );
      parsed.on_screen_text_json = adjustedOverlays.map(({ t, text }) => ({ t, text }));

      // QUALITY GATE: Validate and enhance Sora prompt
      const soraValidation = validateSoraPrompt(parsed.sora_prompt, preset_key);
      console.log(`[Script] Sora prompt quality: ${soraValidation.score}/100`);
      
      if (soraValidation.score < 70) {
        console.log(`[Script] Enhancing Sora prompt (was ${soraValidation.score}/100)`);
        parsed.sora_prompt = enhanceSoraPrompt(parsed.sora_prompt, preset_key);
        console.log(`[Script] Enhanced prompt: ${parsed.sora_prompt.substring(0, 100)}...`);
      }
      
      if (soraValidation.warnings.length > 0) {
        console.warn(`[Script] Sora prompt warnings: ${soraValidation.warnings.join(", ")}`);
      }

      return parsed;
      
    } catch (error) {
      console.error("OpenAI script generation failed:", error);
      throw error;
    }
  }

  async generateBatchScripts(params: {
    intent_text: string;
    preset_key: string;
    mode: string;
    batch_size: number;
    structured_prompt?: object;
  }): Promise<ScriptOutput[]> {
    // For batch generation, we generate sequentially with delays
    const results: ScriptOutput[] = [];
    
    for (let i = 0; i < params.batch_size; i++) {
      const output = await this.generateScript({
        ...params,
        variant_index: i,
      });
      results.push(output);
      
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 100));
    }
    
    return results;
  }
}
