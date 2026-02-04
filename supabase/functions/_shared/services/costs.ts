// FEEDR - Cost Configuration for Edge Functions
// Mirrors lib/costs.ts for backend use

export type QualityMode = "economy" | "balanced" | "premium";

// Quality tier configurations with model mappings
export const QUALITY_TIERS: Record<QualityMode, {
  scriptModel: string;
  scriptService: "openai" | "claude";
  voiceModel: string;
  voiceService: "openai" | "elevenlabs";
  videoModel: string;
  videoService: "runway" | "sora";
  imageModel: string;
  imageService: "dalle" | "flux";
  dalleQuality: "standard" | "hd";
}> = {
  economy: {
    scriptModel: "gpt-4o-mini",
    scriptService: "openai",
    voiceModel: "tts-1",
    voiceService: "openai",
    videoModel: "gen-2",
    videoService: "runway",
    imageModel: "dall-e-2",
    imageService: "dalle",
    dalleQuality: "standard",
  },
  balanced: {
    scriptModel: "claude-3-5-haiku-20241022",
    scriptService: "claude",
    voiceModel: "eleven_turbo_v2_5",
    voiceService: "elevenlabs",
    videoModel: "gen-3",
    videoService: "runway",
    imageModel: "dall-e-3",
    imageService: "dalle",
    dalleQuality: "standard",
  },
  premium: {
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
  let suggestedMode: QualityMode = "economy";
  let reason = "";
  
  if (words < 10 && !hasCreativeKeywords && !hasSpecificRequirements) {
    complexity = "simple";
    suggestedMode = "economy";
    reason = "Simple prompt, economy mode is sufficient";
  } else if (hasCreativeKeywords || hasTechnicalTerms || words > 30) {
    complexity = "complex";
    suggestedMode = "premium";
    reason = "Creative/technical requirements benefit from premium models";
  } else {
    complexity = "moderate";
    suggestedMode = "balanced";
    reason = "Balanced mode offers good quality for this prompt";
  }
  
  return { complexity, suggestedMode, reason };
}

// Estimate costs in cents
export function estimateCost(
  mode: QualityMode,
  outputType: "video" | "image",
  count: number
): number {
  const baseCosts = {
    economy: { video: 15, image: 3 },
    balanced: { video: 45, image: 10 },
    premium: { video: 85, image: 15 },
  };
  
  return baseCosts[mode][outputType] * count;
}
