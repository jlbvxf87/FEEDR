// FEEDR - Claude/Clawdbot Script Service
// Uses Anthropic Claude for script generation

import { 
  ScriptService, 
  ScriptOutput, 
  ScriptGenerationParams,
  SCRIPT_SYSTEM_PROMPT 
} from "./interface.ts";
import {
  getScriptPromptConstraints,
  getScriptConstraintsForDuration,
  validateScriptTiming,
  validateOverlayTiming,
  VIDEO_DURATION,
} from "../../timing.ts";
import { validateSoraPrompt, enhanceSoraPrompt } from "../../quality.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export class ClaudeScriptService implements ScriptService {
  readonly name = "claude";
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
    this.model = Deno.env.get("CLAUDE_MODEL") || "claude-3-sonnet-20240229";
    
    if (!this.apiKey) {
      console.warn("ANTHROPIC_API_KEY not set, Claude service will fail");
    }
  }

  async generateScript(params: ScriptGenerationParams): Promise<ScriptOutput> {
    const { intent_text, preset_key, mode, variant_index, batch_size, research_context, target_duration_sec, structured_prompt } = params;
    
    // Build research section if available from Apify scraping
    let researchSection = "";
    if (research_context?.research_summary) {
      researchSection = `
═══════════════════════════════════════════════════════════════
🔬 RESEARCH INSIGHTS (from ${research_context.scraped_videos?.length || 0} viral examples):
${research_context.research_summary}
═══════════════════════════════════════════════════════════════
Use these real patterns as inspiration. The top performers in this niche use these exact approaches.
`;
    }
    
    const targetDuration = target_duration_sec || VIDEO_DURATION.TARGET;
    const timingConstraints = getScriptPromptConstraints(targetDuration);
    const scriptConstraints = getScriptConstraintsForDuration(targetDuration);
    const overlayMaxStart = Math.max(6, targetDuration - 3);
    
    const userPrompt = `Generate variant ${variant_index + 1} of ${batch_size} for a short-form video.

Topic/Intent: ${intent_text}
Visual Style Preset: ${preset_key}
Test Mode: ${mode}
${researchSection}
${timingConstraints}

CONTENT REQUIREMENTS:
- Each variant should have a DIFFERENT hook approach
- Variant ${variant_index + 1} should use a unique hook style
${research_context?.trend_analysis?.recommended_hooks ? `- Inspired by these proven hooks: ${research_context.trend_analysis.recommended_hooks.slice(0, 2).map(h => `"${h.hook}"`).join(", ")}` : ''}
- Script MUST be ${scriptConstraints.minWords}-${scriptConstraints.maxWords} words (this is CRITICAL - count carefully!)
- Include 4-5 on-screen text overlays (timestamps 0-${overlayMaxStart} seconds only)

${structured_prompt ? `
STRUCTURED CONTEXT (JSON):
${JSON.stringify(structured_prompt, null, 2)}
` : ''}

Return ONLY valid JSON with this exact structure:
{
  "script_spoken": "The full script - MUST be 30-38 words exactly",
  "on_screen_text_json": [
    {"t": 0, "text": "Hook text"},
    {"t": 3, "text": "Key point"},
    {"t": 6, "text": "Support"},
    {"t": 9, "text": "CTA"},
    {"t": 12, "text": "Final"}
  ],
  "sora_prompt": "A detailed prompt for AI video generation describing the visual scene"
}`;

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1000,
          system: SCRIPT_SYSTEM_PROMPT,
          messages: [
            { role: "user", content: userPrompt }
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text;
      
      if (!content) {
        throw new Error("No content in Claude response");
      }

      // Extract JSON from response (Claude might wrap it in text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in Claude response");
      }

      const parsed = JSON.parse(jsonMatch[0]) as ScriptOutput;
      
      // Validate output structure
      if (!parsed.script_spoken || !parsed.on_screen_text_json || !parsed.sora_prompt) {
        throw new Error("Invalid response structure from Claude");
      }

      // Validate and log timing
      const timing = validateScriptTiming(parsed.script_spoken);
      console.log(`[Script] Word count: ${timing.wordCount}, Est. duration: ${timing.estimatedDuration}s`);
      
      if (!timing.isValid) {
        console.warn(`[Script] Timing issues: ${timing.issues.join(", ")}`);
        // If script is too long, truncate to safe word count
        if (timing.wordCount > scriptConstraints.maxWords) {
          const words = parsed.script_spoken.split(/\s+/);
          const truncated = words.slice(0, scriptConstraints.targetWords).join(" ");
          console.log(`[Script] Truncated from ${timing.wordCount} to ${scriptConstraints.targetWords} words`);
          parsed.script_spoken = truncated + "...";
        }
      }

      // Validate and adjust overlay timing to fit within video duration
      const adjustedOverlays = validateOverlayTiming(
        parsed.on_screen_text_json, 
        targetDuration
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
      console.error("Claude script generation failed:", error);
      throw error;
    }
  }

  async generateBatchScripts(params: {
    intent_text: string;
    preset_key: string;
    mode: string;
    batch_size: number;
  }): Promise<ScriptOutput[]> {
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
