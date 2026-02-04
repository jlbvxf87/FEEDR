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

// Default overlay configs per preset
export const PRESET_OVERLAY_CONFIGS: Record<string, OverlayConfig> = {
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
