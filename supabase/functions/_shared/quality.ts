// FEEDR - Quality Assurance Module
// Ensures high-quality output and cost efficiency
// "Make or break" - validate before expensive operations

import { VIDEO_DURATION, SCRIPT_CONSTRAINTS, validateScriptTiming } from "./timing.ts";
import { METHOD_VISUAL_PROMPTS } from "./services/video/interface.ts";

// =============================================================================
// COST ESTIMATES - Know what you're spending before you spend it
// =============================================================================

export const COST_PER_OPERATION = {
  // Research phase (cheap)
  claude_brain: 0.003,          // ~$0.003 per analysis
  apify_scrape: 0.01,           // ~$0.01 per scrape batch
  
  // Script phase (cheap)
  openai_gpt4: 0.01,            // ~$0.01 per script
  claude_sonnet: 0.015,         // ~$0.015 per script
  
  // Voice phase (moderate)
  elevenlabs_voice: 0.05,       // ~$0.05 per 15s voice
  
  // Video phase (EXPENSIVE - gate carefully!)
  // KIE.AI Sora 2 Pro HD: flat per-video pricing by duration tier
  sora_15s: 1.50,               // $1.50 per 15s video (KIE.AI flat rate)
  sora_10s: 1.00,               // $1.00 per 10s video (KIE.AI flat rate)

  // Post-processing
  watermark_removal: 0.05,      // ~$0.05 per video
  
  // Assembly phase (moderate)
  shotstack_render: 0.10,       // ~$0.10 per render
  
  // Image phase
  dalle_standard: 0.04,         // ~$0.04 per image
  dalle_hd: 0.08,               // ~$0.08 per HD image
} as const;

/**
 * Estimate total cost for a batch before running
 */
export function estimateBatchCost(params: {
  batchSize: number;
  outputType: "video" | "image";
  withResearch: boolean;
}): { total: number; breakdown: Record<string, number> } {
  const { batchSize, outputType, withResearch } = params;
  const breakdown: Record<string, number> = {};
  
  if (withResearch) {
    breakdown.research = COST_PER_OPERATION.claude_brain + COST_PER_OPERATION.apify_scrape;
  }
  
  if (outputType === "video") {
    breakdown.scripts = batchSize * COST_PER_OPERATION.openai_gpt4;
    breakdown.voices = batchSize * COST_PER_OPERATION.elevenlabs_voice;
    breakdown.videos = batchSize * COST_PER_OPERATION.sora_15s;
    breakdown.assembly = batchSize * COST_PER_OPERATION.shotstack_render;
  } else {
    breakdown.prompts = batchSize * COST_PER_OPERATION.openai_gpt4;
    breakdown.images = batchSize * COST_PER_OPERATION.dalle_standard;
  }
  
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  
  return { total, breakdown };
}

// =============================================================================
// SORA PROMPT QUALITY VALIDATION
// =============================================================================

/**
 * Quality criteria for Sora prompts
 * A good prompt should describe: WHO, WHERE, WHAT, HOW, MOOD
 */
const SORA_PROMPT_REQUIREMENTS = {
  minLength: 100,              // At least 100 characters
  maxLength: 1000,             // Don't exceed Sora's limit
  requiredElements: [
    { name: "subject", patterns: [/person|man|woman|someone|creator|speaker/i], weight: 2 },
    { name: "action", patterns: [/speaking|talking|looking|gesturing|holding|showing/i], weight: 2 },
    { name: "camera", patterns: [/camera|shot|frame|angle|close-up|wide/i], weight: 1 },
    { name: "lighting", patterns: [/light|lighting|natural|studio|warm|soft|bright/i], weight: 1 },
    { name: "setting", patterns: [/background|setting|room|office|outdoor|studio|home/i], weight: 1 },
    { name: "aspect", patterns: [/vertical|9:16|portrait|smartphone/i], weight: 1 },
  ],
  // Things that make Sora fail or produce bad results
  problematicPatterns: [
    { pattern: /multiple people|crowd|group of/i, reason: "Sora struggles with multiple distinct people" },
    { pattern: /text on screen|words appear|title card/i, reason: "Sora can't render readable text" },
    { pattern: /specific brand|logo|trademark/i, reason: "Avoid brand-specific requests" },
    { pattern: /celebrity|famous person|[A-Z][a-z]+ [A-Z][a-z]+/i, reason: "Avoid named individuals" },
    { pattern: /violence|weapon|blood/i, reason: "Content policy violation risk" },
  ],
};

export interface SoraPromptValidation {
  isValid: boolean;
  score: number;            // 0-100 quality score
  issues: string[];
  warnings: string[];
  suggestions: string[];
  enhancedPrompt?: string;  // Improved version if score < 70
}

/**
 * Validate and optionally enhance a Sora prompt before generation
 */
export function validateSoraPrompt(
  prompt: string, 
  methodKey?: string
): SoraPromptValidation {
  const issues: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // Length checks
  if (prompt.length < SORA_PROMPT_REQUIREMENTS.minLength) {
    issues.push(`Prompt too short (${prompt.length} chars, need ${SORA_PROMPT_REQUIREMENTS.minLength}+)`);
    score -= 30;
  }
  if (prompt.length > SORA_PROMPT_REQUIREMENTS.maxLength) {
    warnings.push(`Prompt may be truncated (${prompt.length} chars, max ${SORA_PROMPT_REQUIREMENTS.maxLength})`);
    score -= 10;
  }

  // Required elements check
  let elementsFound = 0;
  for (const element of SORA_PROMPT_REQUIREMENTS.requiredElements) {
    const hasElement = element.patterns.some(p => p.test(prompt));
    if (hasElement) {
      elementsFound += element.weight;
    } else {
      suggestions.push(`Consider adding: ${element.name} description`);
      score -= 5 * element.weight;
    }
  }

  // Problematic patterns check
  for (const check of SORA_PROMPT_REQUIREMENTS.problematicPatterns) {
    if (check.pattern.test(prompt)) {
      warnings.push(check.reason);
      score -= 15;
    }
  }

  // Ensure score is within bounds
  score = Math.max(0, Math.min(100, score));

  // Generate enhanced prompt if quality is low
  let enhancedPrompt: string | undefined;
  if (score < 70) {
    enhancedPrompt = enhanceSoraPrompt(prompt, methodKey);
  }

  return {
    isValid: score >= 50 && issues.length === 0,
    score,
    issues,
    warnings,
    suggestions,
    enhancedPrompt,
  };
}

/**
 * Enhance a weak Sora prompt with method-specific details
 */
export function enhanceSoraPrompt(prompt: string, methodKey?: string): string {
  // Get method visual guidance
  const methodVisuals = methodKey ? (METHOD_VISUAL_PROMPTS[methodKey] || "") : "";
  
  // Build enhanced prompt with all required elements
  const enhancements: string[] = [];
  
  // Add missing elements
  if (!/vertical|9:16|portrait/i.test(prompt)) {
    enhancements.push("Vertical smartphone format (9:16 aspect ratio)");
  }
  if (!/light/i.test(prompt)) {
    enhancements.push("Natural, flattering lighting");
  }
  if (!/camera|shot/i.test(prompt)) {
    enhancements.push("Medium close-up shot, stable camera");
  }
  if (!/authentic|genuine|natural/i.test(prompt)) {
    enhancements.push("Authentic, genuine feel");
  }
  
  // Combine: Original + Method + Enhancements
  const parts = [
    prompt.trim(),
    methodVisuals,
    ...enhancements,
    "High quality, 1080p HD video, 15 seconds duration."
  ].filter(Boolean);
  
  return parts.join(". ").replace(/\.\./g, ".");
}

// =============================================================================
// SCRIPT QUALITY VALIDATION
// =============================================================================

export interface ScriptValidation {
  isValid: boolean;
  score: number;
  hookStrength: "weak" | "moderate" | "strong";
  issues: string[];
  warnings: string[];
}

const HOOK_PATTERNS = {
  strong: [
    /^(stop|wait|don't|never|always|here's|the secret|nobody|everyone)/i,
    /you (won't|need|have) to/i,
    /\?$/,  // Questions as hooks
    /I (discovered|found|learned|realized)/i,
  ],
  moderate: [
    /^(so|okay|let me|i want)/i,
    /here's (the|what|how)/i,
  ],
  weak: [
    /^(hey|hi|hello|what's up)/i,
    /^(um|uh|like)/i,
    /^(today|in this)/i,
  ],
};

/**
 * Validate script quality for engagement
 */
export function validateScript(script: string, soraPrompt: string): ScriptValidation {
  const issues: string[] = [];
  const warnings: string[] = [];
  let score = 100;
  
  // Timing validation
  const timing = validateScriptTiming(script);
  if (!timing.isValid) {
    issues.push(...timing.issues);
    score -= 20;
  }
  
  // Hook strength analysis
  const firstSentence = script.split(/[.!?]/)[0] || "";
  let hookStrength: "weak" | "moderate" | "strong" = "moderate";
  
  if (HOOK_PATTERNS.strong.some(p => p.test(firstSentence))) {
    hookStrength = "strong";
    score += 5;
  } else if (HOOK_PATTERNS.weak.some(p => p.test(firstSentence))) {
    hookStrength = "weak";
    warnings.push("Hook may not grab attention in first 2 seconds");
    score -= 15;
  }
  
  // Sora prompt quality check
  const soraValidation = validateSoraPrompt(soraPrompt);
  if (!soraValidation.isValid) {
    warnings.push("Sora prompt may produce suboptimal visuals");
    score -= 10;
  }
  
  // Check for filler words
  const fillerWords = /(um|uh|like|you know|basically|literally|actually)/gi;
  const fillerCount = (script.match(fillerWords) || []).length;
  if (fillerCount > 2) {
    warnings.push(`Contains ${fillerCount} filler words - consider removing`);
    score -= fillerCount * 3;
  }
  
  // Ensure score is within bounds
  score = Math.max(0, Math.min(100, score));
  
  return {
    isValid: score >= 60 && issues.length === 0,
    score,
    hookStrength,
    issues,
    warnings,
  };
}

// =============================================================================
// ERROR CLASSIFICATION - Don't retry non-retryable errors
// =============================================================================

export type ErrorType = 
  | "retryable"       // Network issues, rate limits, temporary failures
  | "non_retryable"   // Invalid input, policy violation, permanent failure
  | "budget"          // Out of credits/budget
  | "unknown";

export function classifyError(error: Error | string): {
  type: ErrorType;
  shouldRetry: boolean;
  suggestedAction: string;
} {
  const message = typeof error === "string" ? error : error.message;
  const lowerMessage = message.toLowerCase();
  
  // Non-retryable errors
  if (
    lowerMessage.includes("content policy") ||
    lowerMessage.includes("safety") ||
    lowerMessage.includes("inappropriate") ||
    lowerMessage.includes("violat")
  ) {
    return {
      type: "non_retryable",
      shouldRetry: false,
      suggestedAction: "Content violates policy - modify prompt and try again",
    };
  }
  
  if (
    lowerMessage.includes("invalid") ||
    lowerMessage.includes("malformed") ||
    lowerMessage.includes("missing required")
  ) {
    return {
      type: "non_retryable",
      shouldRetry: false,
      suggestedAction: "Invalid input - check parameters",
    };
  }
  
  // Budget errors
  if (
    lowerMessage.includes("insufficient") ||
    lowerMessage.includes("quota") ||
    lowerMessage.includes("limit exceeded") ||
    lowerMessage.includes("billing") ||
    lowerMessage.includes("credit")
  ) {
    return {
      type: "budget",
      shouldRetry: false,
      suggestedAction: "Out of credits - add more to continue",
    };
  }
  
  // Retryable errors
  if (
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("429") ||
    lowerMessage.includes("503") ||
    lowerMessage.includes("502") ||
    lowerMessage.includes("network") ||
    lowerMessage.includes("temporarily")
  ) {
    return {
      type: "retryable",
      shouldRetry: true,
      suggestedAction: "Temporary issue - will retry automatically",
    };
  }
  
  // Unknown - default to one retry
  return {
    type: "unknown",
    shouldRetry: true,
    suggestedAction: "Unexpected error - attempting retry",
  };
}

// =============================================================================
// PRE-FLIGHT CHECKS - Gate expensive operations
// =============================================================================

export interface PreFlightResult {
  canProceed: boolean;
  estimatedCost: number;
  qualityScore: number;
  blockers: string[];
  warnings: string[];
}

/**
 * Run all pre-flight checks before video generation
 * This is the GATE that prevents wasted money
 */
export function preFlightVideoCheck(params: {
  script: string;
  soraPrompt: string;
  methodKey?: string;
  userCredits?: number;
}): PreFlightResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  
  // 1. Script validation
  const scriptValidation = validateScript(params.script, params.soraPrompt);
  if (!scriptValidation.isValid) {
    blockers.push(...scriptValidation.issues);
  }
  warnings.push(...scriptValidation.warnings);
  
  // 2. Sora prompt validation
  const soraValidation = validateSoraPrompt(params.soraPrompt, params.methodKey);
  if (!soraValidation.isValid) {
    blockers.push(...soraValidation.issues);
  }
  warnings.push(...soraValidation.warnings);
  
  // 3. Cost check
  const estimatedCost = COST_PER_OPERATION.sora_15s +
                        COST_PER_OPERATION.shotstack_render +
                        COST_PER_OPERATION.elevenlabs_voice +
                        COST_PER_OPERATION.watermark_removal;
  
  if (params.userCredits !== undefined && params.userCredits < estimatedCost * 100) {
    blockers.push(`Insufficient credits: need ~$${estimatedCost.toFixed(2)}, have $${(params.userCredits / 100).toFixed(2)}`);
  }
  
  // 4. Calculate overall quality score
  const qualityScore = Math.round(
    (scriptValidation.score * 0.4 + soraValidation.score * 0.6)
  );
  
  // Quality too low = block
  if (qualityScore < 50) {
    blockers.push(`Quality score too low: ${qualityScore}/100 (minimum 50)`);
  }
  
  return {
    canProceed: blockers.length === 0,
    estimatedCost,
    qualityScore,
    blockers,
    warnings,
  };
}

// =============================================================================
// VARIATION QUALITY - Ensure A/B tests are actually different
// =============================================================================

/**
 * Check that script variations are meaningfully different
 * Prevents wasting money on near-duplicate content
 */
export function validateVariationDiversity(scripts: string[]): {
  isValid: boolean;
  diversityScore: number;
  issues: string[];
} {
  if (scripts.length < 2) {
    return { isValid: true, diversityScore: 100, issues: [] };
  }
  
  const issues: string[] = [];
  let totalSimilarity = 0;
  let comparisons = 0;
  
  // Compare each pair of scripts
  for (let i = 0; i < scripts.length; i++) {
    for (let j = i + 1; j < scripts.length; j++) {
      const similarity = calculateSimilarity(scripts[i], scripts[j]);
      totalSimilarity += similarity;
      comparisons++;
      
      if (similarity > 0.7) {
        issues.push(`Variants ${i + 1} and ${j + 1} are ${Math.round(similarity * 100)}% similar - too alike for A/B testing`);
      }
    }
  }
  
  const avgSimilarity = totalSimilarity / comparisons;
  const diversityScore = Math.round((1 - avgSimilarity) * 100);
  
  return {
    isValid: diversityScore >= 40 && issues.length === 0,
    diversityScore,
    issues,
  };
}

/**
 * Simple word-overlap similarity (0-1)
 */
function calculateSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  
  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }
  
  const union = wordsA.size + wordsB.size - overlap;
  return union > 0 ? overlap / union : 0;
}

// =============================================================================
// EXPORTS SUMMARY
// =============================================================================

export const QualityGates = {
  validateSoraPrompt,
  enhanceSoraPrompt,
  validateScript,
  classifyError,
  preFlightVideoCheck,
  validateVariationDiversity,
  estimateBatchCost,
};
