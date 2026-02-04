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
  aspect_ratio?: "9:16" | "16:9" | "1:1"; // default 9:16 for vertical
}

export interface VideoService {
  /** Service identifier */
  readonly name: string;
  
  /** Maximum video duration this service supports */
  readonly maxDuration: number;
  
  /** Supported aspect ratios */
  readonly supportedAspectRatios: string[];
  
  /**
   * Generate video from prompt
   * Returns URL to video file in storage
   */
  generateVideo(params: VideoGenerationParams): Promise<VideoOutput>;
  
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

// Video style guidelines for different presets
export const VIDEO_STYLE_PROMPTS = {
  RAW_UGC_V1: "Authentic, raw footage feel. Slightly shaky handheld camera. Natural lighting. Person speaking directly to camera in casual setting.",
  TIKTOK_AD_V1: "Clean, professional look. Good lighting. Dynamic camera movements. Person presenting with energy and enthusiasm.",
  PODCAST_V1: "Studio-like setting. Stable camera. Professional lighting. Person speaking thoughtfully to camera.",
  SENSORY_V1: "Atmospheric, moody lighting. Slow, deliberate movements. Focus on textures and details.",
  CLEAN_V1: "Minimal, clean aesthetic. Neutral background. Soft, even lighting. Professional but approachable.",
  STORY_V1: "Cinematic feel. Varied shots and angles. Emotional lighting. Storytelling pacing.",
  HOOK_V1: "High energy. Quick movements. Dynamic angles. Attention-grabbing visuals.",
  MINIMAL_V1: "Simple, uncluttered. Focus on the speaker. Minimal distractions. Clean background.",
} as const;
