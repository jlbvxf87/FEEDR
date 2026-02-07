// FEEDR - Timing Constants and Utilities
// Ensures all services sync to the same duration constraints

/**
 * SORA VIDEO CONSTRAINTS
 * Sora 2 Pro produces 10 or 15 second videos only.
 * All content must fit within this window.
 */
export const VIDEO_DURATION = {
  MAX: 15,           // Maximum video duration (Sora limit)
  MIN: 10,           // Minimum video duration option
  TARGET: 15,        // Default target duration
} as const;

/**
 * VOICE TIMING
 * Natural speech rate varies, but we target conversational pace.
 * - Fast speech: ~180 WPM
 * - Normal speech: ~150 WPM  
 * - Slow/dramatic: ~120 WPM
 */
export const VOICE_TIMING = {
  WORDS_PER_MINUTE: 150,     // Target speaking rate
  WORDS_PER_SECOND: 2.5,     // 150/60 = 2.5
  
  // For a 15 second video:
  MAX_WORDS_15SEC: 37,       // 15 * 2.5 = 37.5, round down for safety
  SAFE_WORDS_15SEC: 35,      // Leave buffer for pauses
  
  // For a 10 second video:
  MAX_WORDS_10SEC: 25,
  SAFE_WORDS_10SEC: 22,
} as const;

/**
 * SCRIPT CONSTRAINTS
 * Scripts must be tightly constrained to fit the video duration.
 */
export const SCRIPT_CONSTRAINTS = {
  // Target word counts for different durations
  TARGET_WORDS: 35,          // Optimal for 15 sec
  MIN_WORDS: 25,             // Minimum for engagement
  MAX_WORDS: 40,             // Absolute max (14-16 sec range)
  
  // Character limits (backup constraint)
  MAX_CHARS: 280,            // ~40 words average 7 chars
  
  // Duration constraints
  TARGET_DURATION_SEC: 14,   // Leave 1 sec buffer
  MAX_DURATION_SEC: 15,
  MIN_DURATION_SEC: 10,
} as const;

/**
 * ON-SCREEN TEXT TIMING
 * Overlays must appear within the video duration
 */
export const OVERLAY_TIMING = {
  MIN_DISPLAY_TIME: 1.5,     // Minimum seconds to show text
  MAX_DISPLAY_TIME: 4.0,     // Maximum seconds per overlay
  BUFFER_END: 1.0,           // Don't show text in last 1 second
  MAX_OVERLAYS: 5,           // Limit overlay count for readability
} as const;

/**
 * Calculate estimated duration from word count
 */
export function estimateDurationFromWords(wordCount: number): number {
  return Math.round((wordCount / VOICE_TIMING.WORDS_PER_MINUTE) * 60);
}

/**
 * Calculate safe word count for a target duration
 */
export function getMaxWordsForDuration(durationSec: number): number {
  return Math.floor(durationSec * VOICE_TIMING.WORDS_PER_SECOND);
}

/**
 * Validate script timing - returns issues if any
 */
export function validateScriptTiming(script: string): {
  isValid: boolean;
  wordCount: number;
  estimatedDuration: number;
  issues: string[];
} {
  const wordCount = script.split(/\s+/).filter(w => w.length > 0).length;
  const estimatedDuration = estimateDurationFromWords(wordCount);
  const issues: string[] = [];
  
  if (wordCount > SCRIPT_CONSTRAINTS.MAX_WORDS) {
    issues.push(`Script too long: ${wordCount} words (max ${SCRIPT_CONSTRAINTS.MAX_WORDS})`);
  }
  
  if (wordCount < SCRIPT_CONSTRAINTS.MIN_WORDS) {
    issues.push(`Script too short: ${wordCount} words (min ${SCRIPT_CONSTRAINTS.MIN_WORDS})`);
  }
  
  if (estimatedDuration > SCRIPT_CONSTRAINTS.MAX_DURATION_SEC) {
    issues.push(`Estimated duration ${estimatedDuration}s exceeds ${SCRIPT_CONSTRAINTS.MAX_DURATION_SEC}s limit`);
  }
  
  return {
    isValid: issues.length === 0,
    wordCount,
    estimatedDuration,
    issues,
  };
}

/**
 * Validate and adjust on-screen text timing
 * Ensures all overlays fit within video duration
 */
export function validateOverlayTiming(
  overlays: Array<{ t: number; text: string }>,
  videoDuration: number = VIDEO_DURATION.TARGET
): Array<{ t: number; text: string; duration: number }> {
  const maxEndTime = videoDuration - OVERLAY_TIMING.BUFFER_END;
  
  return overlays
    .filter(item => item.t < maxEndTime) // Remove overlays that start too late
    .slice(0, OVERLAY_TIMING.MAX_OVERLAYS) // Limit count
    .map((item, index, arr) => {
      const nextStart = arr[index + 1]?.t ?? videoDuration;
      const rawDuration = nextStart - item.t;
      
      // Clamp duration between min and max
      const duration = Math.max(
        OVERLAY_TIMING.MIN_DISPLAY_TIME,
        Math.min(rawDuration, OVERLAY_TIMING.MAX_DISPLAY_TIME)
      );
      
      return { ...item, duration };
    });
}

/**
 * Generate script prompt constraints for AI
 */
export function getScriptPromptConstraints(targetDurationSec: number = VIDEO_DURATION.TARGET): string {
  const isShort = targetDurationSec <= 10;
  const maxWords = isShort ? VOICE_TIMING.MAX_WORDS_10SEC : VOICE_TIMING.MAX_WORDS_15SEC;
  const targetWords = isShort ? VOICE_TIMING.SAFE_WORDS_10SEC : VOICE_TIMING.SAFE_WORDS_15SEC;
  const minWords = Math.max(10, Math.floor(targetWords * 0.8));
  const overlayMaxStart = Math.max(6, targetDurationSec - 3);

  return `
CRITICAL TIMING CONSTRAINTS (MUST FOLLOW):
═══════════════════════════════════════════════════════════════
• VIDEO LIMIT: Target duration is ${targetDurationSec} seconds
• SCRIPT LENGTH: MUST be ${minWords}-${maxWords} words (NO EXCEPTIONS)
• Speaking pace: Natural, ~150 words per minute
• Duration: Script must be speakable in ~${Math.max(6, targetDurationSec - 2)}-${targetDurationSec} seconds

WORD COUNT RULES:
- Minimum: ${minWords} words (ensures engagement)
- Target: ${targetWords} words (optimal timing)
- Maximum: ${maxWords} words (HARD LIMIT - do NOT exceed)

If your script exceeds ${maxWords} words, the audio will be cut off.
Count your words carefully before outputting.

ON-SCREEN TEXT TIMING:
- All timestamps must be between 0 and ${overlayMaxStart} seconds
- Each overlay displays for 1.5-3 seconds
- Maximum 5 overlays total
- Last overlay must start by t=${overlayMaxStart} seconds
═══════════════════════════════════════════════════════════════`;
}

export function getScriptConstraintsForDuration(targetDurationSec: number = VIDEO_DURATION.TARGET): {
  maxWords: number;
  targetWords: number;
  minWords: number;
  targetDurationSec: number;
} {
  const isShort = targetDurationSec <= 10;
  const maxWords = isShort ? VOICE_TIMING.MAX_WORDS_10SEC : VOICE_TIMING.MAX_WORDS_15SEC;
  const targetWords = isShort ? VOICE_TIMING.SAFE_WORDS_10SEC : VOICE_TIMING.SAFE_WORDS_15SEC;
  const minWords = Math.max(10, Math.floor(targetWords * 0.8));
  return { maxWords, targetWords, minWords, targetDurationSec };
}
