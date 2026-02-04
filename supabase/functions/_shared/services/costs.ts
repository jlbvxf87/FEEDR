// FEEDR - Cost Configuration for Edge Functions
// Mirrors lib/costs.ts for backend use

export type QualityMode = "fast" | "good" | "better";

// Upsell multiplier: Our cost × 1.5 = User price (50% margin)
export const UPSELL_MULTIPLIER = 1.5;

// Quality tier configurations with model mappings
export const QUALITY_TIERS: Record<QualityMode, {
  scriptModel: string;
  scriptService: "openai" | "claude";
  voiceModel: string;
  voiceService: "openai" | "elevenlabs";
  videoModel: string;
  videoService: "sora";
  imageModel: string;
  imageService: "dalle" | "flux";
  dalleQuality: "standard" | "hd";
}> = {
  fast: {
    scriptModel: "gpt-4o-mini",
    scriptService: "openai",
    voiceModel: "tts-1",
    voiceService: "openai",
    videoModel: "sora",
    videoService: "sora",
    imageModel: "dall-e-2",
    imageService: "dalle",
    dalleQuality: "standard",
  },
  good: {
    scriptModel: "claude-3-5-haiku-20241022",
    scriptService: "claude",
    voiceModel: "eleven_turbo_v2_5",
    voiceService: "elevenlabs",
    videoModel: "sora",
    videoService: "sora",
    imageModel: "dall-e-3",
    imageService: "dalle",
    dalleQuality: "standard",
  },
  better: {
    scriptModel: "claude-sonnet-4-20250514",
    scriptService: "claude",
    voiceModel: "eleven_multilingual_v2",
    voiceService: "elevenlabs",
    videoModel: "sora",
    videoService: "sora",
    imageModel: "dall-e-3",
    imageService: "dalle",
    dalleQuality: "hd",
  },
};

// Analyze prompt to suggest quality tier
export function analyzeComplexity(prompt: string): {
  complexity: "simple" | "moderate" | "complex";
  suggestedMode: QualityMode;
  reason: string;
} {
  const words = prompt.split(/\s+/).length;
  const hasCreativeKeywords = /creative|unique|artistic|cinematic|premium|best|amazing|stunning/i.test(prompt);
  const hasSpecificRequirements = /exactly|specific|must|need|require/i.test(prompt);
  const hasTechnicalTerms = /4k|hdr|raw|professional|studio|high.?quality/i.test(prompt);
  
  let complexity: "simple" | "moderate" | "complex" = "simple";
  let suggestedMode: QualityMode = "fast";
  let reason = "";
  
  if (words < 10 && !hasCreativeKeywords && !hasSpecificRequirements) {
    complexity = "simple";
    suggestedMode = "fast";
    reason = "Simple prompt, fast mode is sufficient";
  } else if (hasCreativeKeywords || hasTechnicalTerms || words > 30) {
    complexity = "complex";
    suggestedMode = "better";
    reason = "Creative/technical requirements benefit from better models";
  } else {
    complexity = "moderate";
    suggestedMode = "good";
    reason = "Good mode offers great quality for this prompt";
  }
  
  return { complexity, suggestedMode, reason };
}

// Base costs in cents (our actual costs)
const BASE_COSTS = {
  fast: { video: 15, image: 3 },
  good: { video: 45, image: 10 },
  better: { video: 85, image: 15 },
};

// Estimate costs in cents (includes upsell - what user pays)
export function estimateCost(
  mode: QualityMode,
  outputType: "video" | "image",
  count: number
): number {
  const baseCost = BASE_COSTS[mode][outputType] * count;
  // Apply upsell multiplier for user-facing price
  return Math.round(baseCost * UPSELL_MULTIPLIER);
}

// Get base cost (our actual cost, without upsell)
export function getBaseCost(
  mode: QualityMode,
  outputType: "video" | "image",
  count: number
): number {
  return BASE_COSTS[mode][outputType] * count;
}
