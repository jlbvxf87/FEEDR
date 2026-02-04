// FEEDR - Mock Script Service
// Used for development and testing

import { ScriptService, ScriptOutput, ScriptGenerationParams } from "./interface.ts";

// Hook templates for mock generation
const HOOK_TEMPLATES = [
  "Wait, you need to see this...",
  "Nobody talks about this but...",
  "Here's what they don't tell you about {topic}",
  "I tested {topic} so you don't have to",
  "Stop scrolling if you're dealing with {topic}",
  "The {topic} secret nobody shares",
  "Why is everyone ignoring {topic}?",
  "This changes everything about {topic}",
  "I was today years old when I learned this about {topic}",
  "POV: You just discovered {topic}",
  "The truth about {topic} that shocked me",
  "If you're struggling with {topic}, watch this",
  "Real talk about {topic}",
  "This {topic} hack is insane",
  "My honest experience with {topic}",
];

export class MockScriptService implements ScriptService {
  readonly name = "mock";

  async generateScript(params: ScriptGenerationParams): Promise<ScriptOutput> {
    const { intent_text, variant_index } = params;
    
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));
    
    const topic = intent_text.split(" ").slice(0, 3).join(" ");
    const hookTemplate = HOOK_TEMPLATES[variant_index % HOOK_TEMPLATES.length];
    const hook = hookTemplate.replace("{topic}", topic);
    
    const script_spoken = `${hook} So I've been researching ${intent_text} for weeks now, and what I found is actually surprising. Most people think they know about this, but they're missing the key insight. Let me break it down for you real quick.`;
    
    const on_screen_text_json = [
      { t: 0.0, text: hook },
      { t: 2.5, text: "Here's what I found..." },
      { t: 5.0, text: `The truth about ${topic}` },
      { t: 7.5, text: "Watch till the end" },
    ];
    
    const sora_prompt = `A person talking directly to camera in vertical smartphone format, casual setting, warm lighting. They are explaining something with engaged facial expressions. The topic is about ${intent_text}. Natural hand gestures, authentic feel, 9:16 aspect ratio.`;
    
    return { script_spoken, on_screen_text_json, sora_prompt };
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
    }
    
    return results;
  }
}
