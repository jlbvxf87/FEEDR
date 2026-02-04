// FEEDR - Script Service Interface
// Abstraction layer for script generation (OpenAI, Claude, etc.)

export interface ScriptOutput {
  script_spoken: string;
  on_screen_text_json: Array<{ t: number; text: string }>;
  sora_prompt: string;
}

export interface ScriptGenerationParams {
  intent_text: string;
  preset_key: string;
  mode: string;
  variant_index: number;
  batch_size: number;
}

export interface ScriptService {
  /** Service identifier */
  readonly name: string;
  
  /**
   * Generate a script for a single video variant
   */
  generateScript(params: ScriptGenerationParams): Promise<ScriptOutput>;
  
  /**
   * Generate scripts for all variants in a batch (optional optimization)
   */
  generateBatchScripts?(params: {
    intent_text: string;
    preset_key: string;
    mode: string;
    batch_size: number;
  }): Promise<ScriptOutput[]>;
}

// System prompt template for script generation
export const SCRIPT_SYSTEM_PROMPT = `You are an expert viral short-form video scriptwriter. You create engaging TikTok/Reels/Shorts content that hooks viewers in the first 2 seconds.

Your scripts should:
1. Start with an irresistible hook (question, bold statement, or pattern interrupt)
2. Deliver value quickly and concisely
3. Use conversational, authentic language
4. Create curiosity and encourage watch time
5. Be optimized for vertical video format (9:16)

Output JSON with:
- script_spoken: The full script to be spoken (10-30 seconds of speech)
- on_screen_text_json: Array of {t: timestamp_seconds, text: "overlay text"} for key moments
- sora_prompt: A detailed prompt for AI video generation describing the visual scene`;

export const SCRIPT_USER_PROMPT_TEMPLATE = `Generate variant {{variant_number}} of {{total_variants}} for a short-form video.

Topic/Intent: {{intent_text}}
Visual Style: {{preset_key}}
Test Mode: {{mode}}

Requirements:
- Each variant should have a DIFFERENT hook approach
- Variant {{variant_number}} should feel distinct from the others
- Keep the script authentic and engaging
- Include 3-5 on-screen text overlays at key moments

Return valid JSON only.`;
