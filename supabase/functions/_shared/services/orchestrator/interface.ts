// FEEDR - OpenClaw Orchestrator Interface
// The intelligent brain that receives user input and executes optimally

export interface UserIntent {
  raw_input: string;
  user_id: string;
  session_id?: string;
}

export interface ParsedIntent {
  // What the user wants
  output_type: "video" | "image";
  content_type: "product" | "lifestyle" | "viral" | "educational" | "ad" | "ugc";
  
  // Extracted entities
  product_name?: string;
  brand?: string;
  target_audience?: string;
  tone?: "professional" | "casual" | "funny" | "dramatic" | "inspiring";
  
  // Inferred settings
  recommended_preset: string;
  recommended_batch_size: number;
  image_pack?: string;
  aspect_ratio?: string;
  
  // Should we research first?
  needs_research: boolean;
  research_query?: string;
  
  // Confidence
  confidence: number;
  reasoning: string;
}

export interface LearningContext {
  // User's past winners
  winner_patterns: {
    preferred_presets: Record<string, number>;
    preferred_hooks: string[];
    preferred_tones: string[];
    avg_script_length: number;
  };
  
  // Recent trends from research
  trending_hooks: string[];
  trending_styles: string[];
  
  // What's worked for similar products
  similar_product_insights?: {
    product: string;
    winning_approach: string;
  }[];
}

export interface ExecutionPlan {
  // The plan OpenClaw creates
  steps: ExecutionStep[];
  estimated_duration_seconds: number;
  estimated_cost_cents: number;
}

export interface ExecutionStep {
  type: "research" | "generate_batch" | "wait" | "notify";
  params: Record<string, any>;
  depends_on?: string[];
}

export interface OrchestratorService {
  readonly name: string;
  
  /**
   * Parse user's raw input into structured intent
   */
  parseIntent(input: UserIntent): Promise<ParsedIntent>;
  
  /**
   * Get learning context for a user (past winners, preferences)
   */
  getLearningContext(user_id: string): Promise<LearningContext>;
  
  /**
   * Create an optimized execution plan
   */
  createPlan(intent: ParsedIntent, context: LearningContext): Promise<ExecutionPlan>;
  
  /**
   * Execute the plan
   */
  execute(plan: ExecutionPlan): Promise<{ batch_id: string }>;
  
  /**
   * Learn from user's winner selection
   */
  recordWinner(batch_id: string, winning_clip_id: string): Promise<void>;
}

// System prompt for intent parsing
export const INTENT_PARSING_PROMPT = `You are OpenClaw, the intelligent orchestrator for FEEDR - a content generation platform.

Your job is to understand what the user wants and make smart decisions about how to create it.

Given a user's input, determine:
1. OUTPUT TYPE: Are they asking for video or image content?
   - Keywords like "video", "clip", "viral", "hook" → video
   - Keywords like "photo", "image", "product shot", "lifestyle" → image
   - If unclear, default to video

2. CONTENT TYPE: What kind of content?
   - "product" - Showcasing a specific product
   - "lifestyle" - Aspirational, context-based content
   - "viral" - Designed to go viral with hooks
   - "educational" - Teaching/explaining something
   - "ad" - Direct promotional content
   - "ugc" - User-generated content style

3. ENTITIES: Extract any mentioned:
   - Product name (e.g., "Jordan 4s", "coffee maker")
   - Brand name
   - Target audience
   - Desired tone

4. PRESET: Recommend the best preset:
   - VIRAL_HOOK - For viral, hook-focused content
   - PRODUCT - Clean product showcase
   - TALKING_HEAD - Person speaking to camera
   - TRENDING_SOUND - Built around trending audio
   - PRODUCT_CLEAN - Clean product images
   - PRODUCT_LIFESTYLE - Product in context
   - AD_BOLD - Bold advertising images
   - UGC_AUTHENTIC - Authentic UGC-style images

5. RESEARCH: Should we scrape TikTok first?
   - Yes if: user mentions "trending", "viral", or we need inspiration
   - Yes if: this is a new product category we haven't seen

Return JSON with your analysis.`;

export const LEARNING_PROMPT = `You are analyzing a user's content generation history to understand their preferences.

Given their past batches and winner selections, identify:
1. Which presets they prefer
2. What hooks/styles win most often
3. Their preferred tone and script length
4. Patterns in their winning content

This will help us generate better content for them in the future.`;
