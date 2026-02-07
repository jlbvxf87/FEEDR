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
  target_duration_sec?: number;
  /** Structured JSON prompt for better worker communication */
  structured_prompt?: StructuredPrompt;
  /** Research context from Apify scraping + Claude analysis */
  research_context?: ResearchContext;
}

/**
 * Research context from the research job
 * Provides real examples and patterns from scraped TikTok videos
 */
export interface ResearchContext {
  /** Scraped video data from TikTok/social */
  scraped_videos: Array<{
    caption: string;
    hook_text?: string;
    views: number;
    likes: number;
  }>;
  /** Claude's analysis of patterns */
  trend_analysis: {
    hook_patterns: Array<{ pattern: string; examples: string[] }>;
    content_structure: { avg_duration_seconds: number; common_formats: string[] };
    recommended_hooks: Array<{ hook: string; reasoning: string }>;
  } | null;
  /** Search query used */
  search_query: string;
  /** Human-readable summary for script generation */
  research_summary: string;
}

/**
 * Structured JSON prompt - converts user input into clear worker instructions
 * This ensures consistent, high-quality output regardless of user prompt style
 */
export interface StructuredPrompt {
  // User's original input
  raw_intent: string;
  
  // Parsed topic/subject
  topic: string;
  
  // Detected or selected method
  method: string;
  
  // Method-specific guidance
  method_config: {
    hook_formula: string;
    pacing: string;
    structure: string[];
    tone: string;
    visual_direction: string;
  };
  
  // Generation context
  context: {
    variant_number: number;
    total_variants: number;
    test_mode: string;
    target_duration_sec: number;
  };

  // Optional high-level directives
  ad_format?: string;
  outcome_goal?: string;
  scene_count?: number;
  compliance?: string[];
  reference_images?: {
    product_url?: string;
    person_url?: string;
  };
  video_generation_mode?: "ttv" | "i2v";
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

// =============================================================================
// METHOD SCRIPT PROMPTS - Rich guidance for each content creation method
// =============================================================================

export const METHOD_SCRIPT_PROMPTS: Record<string, string> = {
  FOUNDERS: `=== FOUNDERS METHOD ===

HOOK FORMULA: Authority statement + personal stake
Examples:
- "After building 3 companies..."
- "I spent $500k learning this..."
- "Most founders get this wrong..."
- "10 years in tech taught me..."

PACING: Measured, confident. Let points land. Don't rush. Speak with authority.

STRUCTURE:
1. [0-3s] Hook with credibility or stakes - establish why they should listen
2. [3-10s] The insight or contrarian take - the core value
3. [10-20s] Proof point or personal example - make it real
4. [20-25s] What this means for the viewer - the takeaway

TONE: Authoritative but approachable. Mentor energy. Speak from experience.
VISUAL: Face-to-camera, stable shot, professional setting.`,

  PODCAST: `=== PODCAST METHOD ===

HOOK FORMULA: Hot take or opinion that demands a response
Examples:
- "Unpopular opinion but..."
- "Nobody wants to admit this..."
- "I genuinely think..."
- "Hot take: [controversial statement]"

PACING: Conversational, like explaining to a friend. Natural pauses for emphasis.

STRUCTURE:
1. [0-2s] The hot take/opinion - bold and clear
2. [2-10s] Why you think this - your reasoning
3. [10-18s] Example or evidence - support your point
4. [18-22s] Challenge or question to viewer - invite engagement

TONE: Opinionated but not aggressive. Inviting debate. Podcast-style authenticity.
VISUAL: Talking head, could be split-screen reaction style. Expressive.`,

  DISCOVERY: `=== DISCOVERY METHOD ===

HOOK FORMULA: Curiosity gap - something you just learned
Examples:
- "I just found out..."
- "Nobody is talking about this..."
- "This changes everything about..."
- "So apparently [surprising thing]..."

PACING: Building excitement. Start curious, build energy, end amazed.

STRUCTURE:
1. [0-2s] Curiosity hook - create the gap
2. [2-8s] Context - what led to this discovery
3. [8-15s] The reveal - the actual discovery
4. [15-20s] Why this matters - implications

TONE: Genuinely surprised, sharing something exciting. Discovery energy.
VISUAL: Casual, authentic feel. Natural setting. Real reactions.`,

  CAMERA_PUT_DOWN: `=== CAMERA PUT DOWN METHOD ===

HOOK FORMULA: Mid-sentence start, already in motion
Examples:
- "Okay real quick..."
- "I need to tell you something..."
- "Stop what you're doing..."
- "Listen—" (already mid-thought)

PACING: Fast, urgent, raw energy. No filler words. Get to the point immediately.

STRUCTURE:
1. [0-1s] Already mid-thought, urgent energy
2. [1-8s] The point - no buildup, straight to value
3. [8-12s] Quick proof/example
4. [12-15s] Rapid CTA or conclusion

TONE: Urgent, casual, caught-in-the-moment authenticity.
VISUAL: Handheld feel, slight movement, authentic messy environment.`,

  SENSORY: `=== SENSORY METHOD ===

HOOK FORMULA: Visual intrigue, texture focus
Examples:
- "Watch this..."
- "This is so satisfying..."
- "Look at the texture..."
- "POV: you're watching [satisfying thing]"

PACING: Slow, deliberate, ASMR-like. Let visuals breathe. Minimal talking.

STRUCTURE:
1. [0-3s] Visual hook - show don't tell
2. [3-12s] Slow reveal with soft explanation
3. [12-18s] Peak satisfaction moment
4. [18-22s] Soft close

TONE: Calm, almost meditative. Let the visuals do the work. Whisper energy.
VISUAL: Extreme close-ups, textures, satisfying movements. Macro-style.`,

  DELAYED_GRATIFICATION: `=== DELAYED GRATIFICATION METHOD ===

HOOK FORMULA: Tease the payoff upfront
Examples:
- "Wait for it..."
- "Watch until the end..."
- "The transformation is insane..."
- "You won't believe what happens..."

PACING: Tension building. Each beat raises stakes. Slower before reveal.

STRUCTURE:
1. [0-3s] Tease the payoff - promise something amazing
2. [3-10s] Setup / before state - establish the baseline
3. [10-18s] Building tension - "almost there" energy
4. [18-25s] The reveal / payoff - deliver on the promise

TONE: Building anticipation. Make them NEED to see the end.
VISUAL: Dynamic, movement, before/after framing, cinematic reveal.`
};

// =============================================================================
// METHOD VISUAL PROMPTS - Camera and visual direction per method
// =============================================================================

export const METHOD_VISUAL_PROMPTS: Record<string, string> = {
  FOUNDERS: "Professional setting. Person speaking directly to camera with authority and confidence. Stable, well-composed shot. Good lighting - natural or studio. Office, studio, or clean neutral background. Measured gestures, confident posture.",
  
  PODCAST: "Talking head format. Person speaking with energy and expression. Could be single shot or designed for split-screen. Good audio environment implied. Conversational body language, reactive expressions.",
  
  DISCOVERY: "Casual, authentic environment. Person genuinely excited sharing something new. Natural lighting preferred. Home, outdoor, or relatable setting. Expressive reactions, building energy.",
  
  CAMERA_PUT_DOWN: "Caught-in-the-moment feel. Slight camera movement as if phone just placed down. Person already mid-thought, urgent energy. Natural lighting, authentic messy environment. Raw, unpolished aesthetic.",
  
  SENSORY: "Extreme close-up shots. Macro-style photography. Focus on textures, details, satisfying visuals. Slow, deliberate camera movements or static beauty shots. ASMR-adjacent feel. Rich colors and tactile surfaces.",
  
  DELAYED_GRATIFICATION: "Dynamic, anticipation-building shots. Setup for transformation or reveal. Movement that builds tension. Good before/after framing potential. Cinematic feel with payoff composition."
};

// =============================================================================
// SYSTEM PROMPT - Enhanced with method awareness
// =============================================================================

export const SCRIPT_SYSTEM_PROMPT = `You are an expert viral short-form video scriptwriter. You create engaging TikTok/Reels/Shorts content that hooks viewers in the first 2 seconds and keeps them watching.

CRITICAL RULES:
1. FOLLOW THE METHOD EXACTLY - each method has a specific hook formula, pacing, and structure
2. The hook is everything - 71% of viewers decide in the first 3 seconds
3. Use conversational, authentic language - never corporate or salesy
4. Every second counts - no filler, no "hey guys", no wasted time
5. On-screen text should ENHANCE not repeat the spoken words

OUTPUT FORMAT (JSON):
{
  "script_spoken": "The exact words to be spoken",
  "on_screen_text_json": [
    {"t": 0, "text": "HOOK TEXT - bold, attention-grabbing"},
    {"t": 3, "text": "Key point reinforcement"},
    ...
  ],
  "sora_prompt": "Detailed visual description for video generation"
}

REMEMBER: The method's structure includes TIMING MARKERS [0-3s], [3-10s], etc. - use these to pace your script correctly.`;
