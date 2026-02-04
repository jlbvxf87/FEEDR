// FEEDR - Assembly Service Interface
// Abstraction layer for video assembly (FFmpeg, cloud services, etc.)

export interface AssemblyOutput {
  final_url: string;
  duration_seconds: number;
}

export interface CaptionStyle {
  enabled: boolean;
  font?: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  position?: "bottom" | "center" | "top";
  animation?: "none" | "fade" | "pop" | "typewriter";
}

export interface OverlayConfig {
  captions?: CaptionStyle;
  fake_comments?: {
    enabled: boolean;
    variant?: "tiktok" | "instagram" | "youtube";
    count?: number;
  };
  progress_bar?: {
    enabled: boolean;
    color?: string;
    position?: "top" | "bottom";
  };
  endcard?: {
    enabled: boolean;
    duration_sec?: number;
    template?: string;
  };
  zoom?: {
    enabled: boolean;
    cadence_sec?: number;
    min?: number;
    max?: number;
  };
  logo?: {
    enabled: boolean;
    position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    opacity?: number;
  };
}

export interface AssemblyParams {
  clip_id: string;
  raw_video_url: string;
  voice_url: string;
  on_screen_text_json: Array<{ t: number; text: string }>;
  preset_key: string;
  overlay_config: OverlayConfig;
  /** Video duration in seconds (default: 15, Sora max) */
  duration_sec?: number;
}

export interface AssemblyService {
  /** Service identifier */
  readonly name: string;
  
  /**
   * Assemble final video from components
   * - Combines raw video with voice audio
   * - Adds overlays based on preset config
   * - Returns URL to final video in storage
   */
  assembleVideo(params: AssemblyParams): Promise<AssemblyOutput>;
}

// =============================================================================
// METHOD OVERLAY CONFIGS - Tuned zoom/caption settings per content method
// Each method's energy and pacing reflected in overlay timing
// =============================================================================

export const METHOD_OVERLAY_CONFIGS: Record<string, OverlayConfig> = {
  // PRIMARY METHODS (creator-familiar names)
  
  FOUNDERS: {
    // Professional, measured - subtle enhancements that don't distract
    captions: { enabled: true, animation: "fade", position: "bottom", fontSize: 32 },
    fake_comments: { enabled: false },
    progress_bar: { enabled: false },
    zoom: { enabled: true, cadence_sec: 5, min: 1.0, max: 1.05 }, // Subtle, professional
  },
  
  PODCAST: {
    // Conversational rhythm - captions follow natural speech patterns
    captions: { enabled: true, animation: "pop", position: "center", fontSize: 36 },
    fake_comments: { enabled: false },
    progress_bar: { enabled: false },
    zoom: { enabled: true, cadence_sec: 3, min: 1.0, max: 1.08 }, // Conversational rhythm
  },
  
  DISCOVERY: {
    // Building excitement - faster reveals, typewriter for anticipation
    captions: { enabled: true, animation: "typewriter", position: "center", fontSize: 38 },
    fake_comments: { enabled: false },
    progress_bar: { enabled: false },
    zoom: { enabled: true, cadence_sec: 2.5, min: 1.0, max: 1.12 }, // Building excitement
  },
  
  CAMERA_PUT_DOWN: {
    // Fast, urgent - aggressive zoom, punchy captions
    captions: { enabled: true, animation: "pop", position: "center", fontSize: 42 },
    fake_comments: { enabled: false },
    progress_bar: { enabled: false },
    zoom: { enabled: true, cadence_sec: 1.5, min: 1.0, max: 1.15 }, // Fast, energetic
  },
  
  SENSORY: {
    // Slow, dramatic - let visuals breathe, subtle text
    captions: { enabled: true, animation: "fade", position: "bottom", fontSize: 28 },
    fake_comments: { enabled: false },
    progress_bar: { enabled: false },
    zoom: { enabled: true, cadence_sec: 8, min: 1.0, max: 1.25 }, // Slow, dramatic
  },
  
  DELAYED_GRATIFICATION: {
    // Tension building - progress bar shows journey to payoff
    captions: { enabled: true, animation: "typewriter", position: "center", fontSize: 36 },
    fake_comments: { enabled: false },
    progress_bar: { enabled: true, position: "top" }, // Shows progress to payoff
    zoom: { enabled: true, cadence_sec: 2, min: 1.0, max: 1.1 }, // Tension building
  },

  // LEGACY PRESETS (backwards compatibility)
  
  RAW_UGC_V1: {
    captions: { enabled: true, animation: "pop", position: "center" },
    fake_comments: { enabled: false },
    progress_bar: { enabled: false },
    zoom: { enabled: true, cadence_sec: 3, min: 1.0, max: 1.15 },
  },
  TIKTOK_AD_V1: {
    captions: { enabled: true, animation: "typewriter", position: "center" },
    fake_comments: { enabled: true, variant: "tiktok", count: 3 },
    progress_bar: { enabled: true, position: "top" },
    zoom: { enabled: true, cadence_sec: 2, min: 1.0, max: 1.1 },
  },
  PODCAST_V1: {
    captions: { enabled: true, animation: "fade", position: "bottom" },
    fake_comments: { enabled: false },
    progress_bar: { enabled: false },
    zoom: { enabled: false },
  },
  SENSORY_V1: {
    captions: { enabled: true, animation: "fade", position: "bottom" },
    fake_comments: { enabled: false },
    progress_bar: { enabled: true, position: "bottom" },
    zoom: { enabled: true, cadence_sec: 5, min: 1.0, max: 1.2 },
  },
  CLEAN_V1: {
    captions: { enabled: false },
    fake_comments: { enabled: false },
    progress_bar: { enabled: false },
    zoom: { enabled: false },
  },
  STORY_V1: {
    captions: { enabled: true, animation: "typewriter", position: "bottom" },
    fake_comments: { enabled: false },
    progress_bar: { enabled: true, position: "top" },
    zoom: { enabled: true, cadence_sec: 4, min: 1.0, max: 1.1 },
  },
  HOOK_V1: {
    captions: { enabled: true, animation: "pop", position: "center", fontSize: 48 },
    fake_comments: { enabled: false },
    progress_bar: { enabled: false },
    zoom: { enabled: true, cadence_sec: 1.5, min: 1.0, max: 1.2 },
  },
  MINIMAL_V1: {
    captions: { enabled: true, animation: "none", position: "bottom" },
    fake_comments: { enabled: false },
    progress_bar: { enabled: false },
    zoom: { enabled: false },
  },
};

// Legacy export for backwards compatibility
export const PRESET_OVERLAY_CONFIGS = METHOD_OVERLAY_CONFIGS;

/**
 * Get overlay config for a method/preset key
 * Falls back to FOUNDERS if not found
 */
export function getOverlayConfig(methodKey: string): OverlayConfig {
  return METHOD_OVERLAY_CONFIGS[methodKey] || METHOD_OVERLAY_CONFIGS.FOUNDERS;
}
