// FEEDR - Cost Configuration & Smart Model Routing
// Defines pricing tiers and optimal model selection

export type QualityMode = "fast" | "good" | "better";

// Upsell multiplier: Our cost × 1.5 = User price (50% margin)
export const UPSELL_MULTIPLIER = 1.5;

// Cost per 1M tokens (in cents) - BASE COSTS (our actual costs)
export const MODEL_COSTS = {
  // Script/Brain models
  script: {
    "claude-3-haiku-20240307": { input: 25, output: 125, quality: 0.7 },
    "claude-3-5-haiku-20241022": { input: 100, output: 500, quality: 0.8 },
    "claude-3-5-sonnet-20241022": { input: 300, output: 1500, quality: 0.95 },
    "claude-sonnet-4-20250514": { input: 300, output: 1500, quality: 0.95 },
    "gpt-4o-mini": { input: 15, output: 60, quality: 0.75 },
    "gpt-4o": { input: 250, output: 1000, quality: 0.9 },
    "gpt-4-turbo": { input: 1000, output: 3000, quality: 0.85 },
  },
  
  // Voice models (cost per character in cents)
  voice: {
    "elevenlabs-standard": { perChar: 0.03, quality: 0.95 },
    "elevenlabs-turbo": { perChar: 0.015, quality: 0.85 },
    "openai-tts-1": { perChar: 0.015, quality: 0.75 },
    "openai-tts-1-hd": { perChar: 0.03, quality: 0.85 },
  },
  
  // Video models (cost per second in cents)
  video: {
    "sora": { perSecond: 5, quality: 0.95 },
  },
  
  // Image models (cost per image in cents)
  image: {
    "dall-e-3-hd": { perImage: 12, quality: 0.95 },
    "dall-e-3": { perImage: 8, quality: 0.9 },
    "dall-e-2": { perImage: 2, quality: 0.7 },
    "flux-1.1-pro": { perImage: 4, quality: 0.9 },
    "flux-schnell": { perImage: 0.3, quality: 0.75 },
  },
  
  // Assembly (cost per render in cents)
  assembly: {
    "shotstack": { perRender: 5, quality: 0.9 },
    "creatomate": { perRender: 4, quality: 0.85 },
  },
};

// Quality tier configurations
export const QUALITY_TIERS: Record<QualityMode, {
  label: string;
  description: string;
  icon: string;
  scriptModel: string;
  voiceModel: string;
  videoModel: string;
  imageModel: string;
  costMultiplier: number;
}> = {
  fast: {
    label: "Fast",
    description: "Quickest results, budget-friendly",
    icon: "⚡",
    scriptModel: "gpt-4o-mini",
    voiceModel: "openai-tts-1",
    videoModel: "sora",
    imageModel: "dall-e-2",
    costMultiplier: 1.0, // Base tier - no additional multiplier
  },
  good: {
    label: "Good",
    description: "Great quality, balanced cost",
    icon: "✓",
    scriptModel: "claude-3-5-haiku-20241022",
    voiceModel: "elevenlabs-turbo",
    videoModel: "sora",
    imageModel: "dall-e-3",
    costMultiplier: 1.0, // Uses actual model costs
  },
  better: {
    label: "Better",
    description: "Premium quality, best results",
    icon: "★",
    scriptModel: "claude-sonnet-4-20250514",
    voiceModel: "elevenlabs-standard",
    videoModel: "sora",
    imageModel: "dall-e-3-hd",
    costMultiplier: 1.0, // Uses actual model costs
  },
};

// Estimate cost for a single video
// Returns user-facing price (base cost × upsell multiplier)
export function estimateVideoCost(
  mode: QualityMode,
  durationSeconds: number = 15,
  scriptLength: number = 150
): { total: number; baseCost: number; breakdown: Record<string, number> } {
  const tier = QUALITY_TIERS[mode];
  
  // Script cost (assuming ~500 input tokens, ~200 output tokens)
  const scriptCosts = MODEL_COSTS.script[tier.scriptModel as keyof typeof MODEL_COSTS.script];
  const scriptCost = scriptCosts 
    ? ((500 * scriptCosts.input + 200 * scriptCosts.output) / 1000000) * 100
    : 1;
  
  // Voice cost
  const voiceCosts = MODEL_COSTS.voice[tier.voiceModel as keyof typeof MODEL_COSTS.voice];
  const voiceCost = voiceCosts ? scriptLength * voiceCosts.perChar : 2;
  
  // Video cost
  const videoCosts = MODEL_COSTS.video[tier.videoModel as keyof typeof MODEL_COSTS.video];
  const videoCost = videoCosts ? durationSeconds * videoCosts.perSecond : 25;
  
  // Assembly cost
  const assemblyCost = 5;
  
  const breakdown = {
    script: Math.round(scriptCost * 100) / 100,
    voice: Math.round(voiceCost * 100) / 100,
    video: Math.round(videoCost * 100) / 100,
    assembly: assemblyCost,
  };
  
  // Base cost is our actual cost
  const baseCost = Object.values(breakdown).reduce((a, b) => a + b, 0);
  // User pays base cost × upsell multiplier
  const total = Math.round(baseCost * UPSELL_MULTIPLIER);
  
  return { total, baseCost: Math.round(baseCost), breakdown };
}

// Estimate cost for a batch of images
// Returns user-facing price (base cost × upsell multiplier)
export function estimateImageCost(
  mode: QualityMode,
  count: number = 8
): { total: number; baseCost: number; breakdown: Record<string, number> } {
  const tier = QUALITY_TIERS[mode];
  
  // Script cost for prompts
  const scriptCosts = MODEL_COSTS.script[tier.scriptModel as keyof typeof MODEL_COSTS.script];
  const scriptCost = scriptCosts 
    ? ((300 * scriptCosts.input + 100 * scriptCosts.output) / 1000000) * 100 * count
    : 0.5 * count;
  
  // Image generation cost
  const imageCosts = MODEL_COSTS.image[tier.imageModel as keyof typeof MODEL_COSTS.image];
  const imageCost = imageCosts ? count * imageCosts.perImage : count * 5;
  
  const breakdown = {
    script: Math.round(scriptCost * 100) / 100,
    images: Math.round(imageCost * 100) / 100,
  };
  
  // Base cost is our actual cost
  const baseCost = Object.values(breakdown).reduce((a, b) => a + b, 0);
  // User pays base cost × upsell multiplier
  const total = Math.round(baseCost * UPSELL_MULTIPLIER);
  
  return { total, baseCost: Math.round(baseCost), breakdown };
}

// Estimate batch cost
// Returns user-facing price (includes upsell) and base cost (our actual cost)
export function estimateBatchCost(
  mode: QualityMode,
  outputType: "video" | "image",
  batchSize: number
): { totalCents: number; baseCostCents: number; perItemCents: number; breakdown: Record<string, number> } {
  if (outputType === "image") {
    const estimate = estimateImageCost(mode, batchSize);
    return {
      totalCents: estimate.total,
      baseCostCents: estimate.baseCost,
      perItemCents: Math.round(estimate.total / batchSize),
      breakdown: estimate.breakdown,
    };
  }
  
  const estimate = estimateVideoCost(mode);
  return {
    totalCents: estimate.total * batchSize,
    baseCostCents: estimate.baseCost * batchSize,
    perItemCents: estimate.total,
    breakdown: estimate.breakdown,
  };
}

// Analyze prompt complexity to suggest quality tier
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

// Format cost for display
export function formatCost(cents: number): string {
  if (cents < 100) {
    return `${cents}¢`;
  }
  return `$${(cents / 100).toFixed(2)}`;
}
