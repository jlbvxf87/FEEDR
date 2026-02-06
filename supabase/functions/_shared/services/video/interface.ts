// FEEDR - Video Service Interface
// Abstraction layer for video generation (Sora/KEIAPI, Runway, etc.)

export interface VideoOutput {
  raw_video_url: string;
  duration_seconds?: number;
  width?: number;
  height?: number;
}

export interface VideoGenerationParams {
  prompt: string;
  clip_id: string;
  duration?: number; // seconds, default 15
  aspect_ratio?: "9:16" | "16:9" | "1:1" | "4:5"; // default 9:16 for vertical
  method?: string; // Content method for enhanced visual direction
  platform?: string; // Target platform for optimized output
  quality?: "standard" | "hd"; // Quality tier
}

// =============================================================================
// VIDEO PLATFORM SPECS - Optimized dimensions for each platform
// =============================================================================

export const VIDEO_PLATFORM_SPECS = {
  // Vertical formats (9:16)
  tiktok: {
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    maxDuration: 180,
    frameRate: 30,
    codec: "h264",
    description: "TikTok vertical video"
  },
  instagram_reels: {
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    maxDuration: 90,
    frameRate: 30,
    codec: "h264",
    description: "Instagram Reels"
  },
  youtube_shorts: {
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    maxDuration: 60,
    frameRate: 30,
    codec: "h264",
    description: "YouTube Shorts"
  },
  instagram_story: {
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    maxDuration: 60,
    frameRate: 30,
    codec: "h264",
    description: "Instagram Story"
  },
  
  // Portrait format (4:5)
  instagram_feed: {
    width: 1080,
    height: 1350,
    aspectRatio: "4:5",
    maxDuration: 60,
    frameRate: 30,
    codec: "h264",
    description: "Instagram Feed (portrait)"
  },
  
  // Square format (1:1)
  square: {
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    maxDuration: 60,
    frameRate: 30,
    codec: "h264",
    description: "Square video (Facebook, LinkedIn)"
  },
  
  // Landscape format (16:9)
  youtube: {
    width: 1920,
    height: 1080,
    aspectRatio: "16:9",
    maxDuration: 43200,
    frameRate: 30,
    codec: "h264",
    description: "YouTube standard video"
  },
  twitter: {
    width: 1280,
    height: 720,
    aspectRatio: "16:9",
    maxDuration: 140,
    frameRate: 30,
    codec: "h264",
    description: "Twitter/X video"
  }
} as const;

// Quick lookup: aspect ratio to platform-ready dimensions
export const VIDEO_ASPECT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },  // TikTok, Reels, Shorts, Stories
  "4:5": { width: 1080, height: 1350 },   // Instagram Feed optimal
  "1:1": { width: 1080, height: 1080 },   // Square (Facebook, LinkedIn)
  "16:9": { width: 1920, height: 1080 },  // YouTube, Twitter
};

export interface VideoService {
  /** Service identifier */
  readonly name: string;
  
  /** Maximum video duration this service supports */
  readonly maxDuration: number;
  
  /** Supported aspect ratios */
  readonly supportedAspectRatios: string[];
  
  /**
   * Generate video from prompt (synchronous - blocks until done)
   * Returns URL to video file in storage
   */
  generateVideo(params: VideoGenerationParams): Promise<VideoOutput>;

  /**
   * Submit a video generation task (async - returns immediately with task ID)
   * Used for services that take minutes (Sora, Runway, etc.)
   */
  submitVideo?(params: VideoGenerationParams): Promise<string>;

  /**
   * Download a completed video and upload to Supabase storage
   */
  downloadAndUploadVideo?(videoUrl: string, clipId: string): Promise<VideoOutput>;

  /**
   * Check status of an ongoing generation (for async services)
   */
  checkStatus?(jobId: string): Promise<{
    status: "pending" | "processing" | "completed" | "failed";
    progress?: number;
    result?: VideoOutput;
    error?: string;
  }>;
}

// =============================================================================
// METHOD VISUAL PROMPTS - Detailed camera and visual direction per method
// =============================================================================

export const METHOD_VISUAL_PROMPTS: Record<string, string> = {
  // Primary methods (creator-familiar names)
  FOUNDERS: "Professional setting. Person speaking directly to camera with authority and confidence. Stable, well-composed shot. Good lighting - natural or studio. Office, studio, or clean neutral background. Measured gestures, confident posture. Eye contact with lens.",
  
  PODCAST: "Talking head format. Person speaking with energy and expression. Could be single shot or designed for split-screen. Good audio environment implied. Conversational body language, reactive expressions. Engaging and animated.",
  
  DISCOVERY: "Casual, authentic environment. Person genuinely excited sharing something new. Natural lighting preferred. Home, outdoor, or relatable setting. Expressive reactions, building energy. Authentic surprise and enthusiasm.",
  
  CAMERA_PUT_DOWN: "Caught-in-the-moment feel. Slight camera movement as if phone just placed down. Person already mid-thought, urgent energy. Natural lighting, authentic messy environment. Raw, unpolished aesthetic. Handheld shake.",
  
  SENSORY: "Extreme close-up shots. Macro-style photography. Focus on textures, details, satisfying visuals. Slow, deliberate camera movements or static beauty shots. ASMR-adjacent feel. Rich colors and tactile surfaces. Smooth, hypnotic motion.",
  
  DELAYED_GRATIFICATION: "Dynamic, anticipation-building shots. Setup for transformation or reveal. Movement that builds tension. Good before/after framing potential. Cinematic feel with payoff composition. Dramatic lighting shifts.",

  // Legacy presets (mapped to methods for backwards compatibility)
  RAW_UGC_V1: "Authentic, raw footage feel. Slightly shaky handheld camera. Natural lighting. Person speaking directly to camera in casual setting.",
  TIKTOK_AD_V1: "Clean, professional look. Good lighting. Dynamic camera movements. Person presenting with energy and enthusiasm.",
  PODCAST_V1: "Studio-like setting. Stable camera. Professional lighting. Person speaking thoughtfully to camera.",
  SENSORY_V1: "Atmospheric, moody lighting. Slow, deliberate movements. Focus on textures and details.",
  CLEAN_V1: "Minimal, clean aesthetic. Neutral background. Soft, even lighting. Professional but approachable.",
  STORY_V1: "Cinematic feel. Varied shots and angles. Emotional lighting. Storytelling pacing.",
  HOOK_V1: "High energy. Quick movements. Dynamic angles. Attention-grabbing visuals.",
  MINIMAL_V1: "Simple, uncluttered. Focus on the speaker. Minimal distractions. Clean background.",
};

// Legacy export for backwards compatibility
export const VIDEO_STYLE_PROMPTS = METHOD_VISUAL_PROMPTS;

/**
 * Get visual prompt for a method/preset key
 * Falls back to FOUNDERS if not found
 */
export function getVisualPrompt(methodKey: string): string {
  return METHOD_VISUAL_PROMPTS[methodKey] || METHOD_VISUAL_PROMPTS.FOUNDERS;
}
