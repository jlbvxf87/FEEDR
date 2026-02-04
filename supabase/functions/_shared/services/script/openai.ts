// FEEDR - OpenAI Script Service
// Uses GPT-4 for script generation

import { 
  ScriptService, 
  ScriptOutput, 
  ScriptGenerationParams,
  SCRIPT_SYSTEM_PROMPT 
} from "./interface.ts";

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
          temperature: 0.8, // Higher creativity for varied hooks
          max_tokens: 1000,
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
  }): Promise<ScriptOutput[]> {
    // For batch generation, we could use a single call with multiple variants
    // But for reliability, we'll generate sequentially with delays
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
