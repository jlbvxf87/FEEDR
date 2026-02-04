// FEEDR - Orchestrator Interface with Quality Mode Support

import { QualityMode } from "../costs.ts";

export interface UserIntent {
  raw_input: string;
  user_id: string;
  quality_mode?: QualityMode;
}

export interface ParsedIntent {
  output_type: "video" | "image";
  content_type: "product" | "lifestyle" | "viral" | "educational" | "ad" | "ugc";
  product_name?: string;
  recommended_preset: string;
  recommended_batch_size: number;
  image_pack?: string;
  aspect_ratio?: string;
  needs_research: boolean;
  research_query?: string;
  confidence: number;
  reasoning: string;
  // Quality optimization
  quality_mode?: QualityMode;
  model_config?: {
    scriptModel: string;
    scriptService: string;
    voiceModel: string;
    voiceService: string;
    videoModel: string;
    videoService: string;
    imageModel: string;
    imageService: string;
    dalleQuality?: string;
  };
  estimated_cost_cents?: number;
}

export interface LearningContext {
  winner_patterns: {
    preferred_presets: Record<string, number>;
    preferred_hooks: string[];
    preferred_tones: string[];
    avg_script_length: number;
  };
  trending_hooks: string[];
  trending_styles: string[];
}

export interface ExecutionPlan {
  steps: ExecutionStep[];
  estimated_duration_seconds: number;
  estimated_cost_cents: number;
  quality_mode?: QualityMode;
}

export interface ExecutionStep {
  type: "research" | "generate_batch" | "wait" | "notify";
  params: Record<string, any>;
  depends_on?: string[];
}

export interface OrchestratorService {
  readonly name: string;
  parseIntent(input: UserIntent): Promise<ParsedIntent>;
  getLearningContext(user_id: string): Promise<LearningContext>;
  createPlan(intent: ParsedIntent, context: LearningContext): Promise<ExecutionPlan>;
  execute(plan: ExecutionPlan): Promise<{ batch_id: string; quality_mode?: string }>;
}

export const INTENT_PARSING_PROMPT = `You are the intelligent orchestrator for FEEDR - a content generation platform.
Parse user input and determine: output type (video/image), content type, preset, and whether research is needed.

Consider prompt complexity:
- Simple prompts (few words, basic requests) → suggest economy mode
- Moderate prompts (specific requirements) → suggest balanced mode  
- Complex prompts (creative, technical, professional) → suggest premium mode

Return JSON with: output_type, content_type, product_name, recommended_preset, needs_research, image_pack (for images), confidence, reasoning.`;
