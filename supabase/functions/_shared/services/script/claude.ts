// FEEDR - Claude/Clawdbot Script Service
// Uses Anthropic Claude for script generation

import { 
  ScriptService, 
  ScriptOutput, 
  ScriptGenerationParams,
  SCRIPT_SYSTEM_PROMPT 
} from "./interface.ts";

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
    const { intent_text, preset_key, mode, variant_index, batch_size } = params;
    
    const userPrompt = `Generate variant ${variant_index + 1} of ${batch_size} for a short-form video.

Topic/Intent: ${intent_text}
Visual Style Preset: ${preset_key}
Test Mode: ${mode}

Requirements:
- Each variant should have a DIFFERENT hook approach
- Variant ${variant_index + 1} should use a unique hook style
- Keep the script authentic and engaging (15-30 seconds when spoken)
- Include 4-6 on-screen text overlays at key moments

Return ONLY valid JSON with this exact structure:
{
  "script_spoken": "The full script to be spoken by the creator",
  "on_screen_text_json": [
    {"t": 0, "text": "Hook text"},
    {"t": 2.5, "text": "Second overlay"},
    {"t": 5, "text": "Third overlay"}
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
