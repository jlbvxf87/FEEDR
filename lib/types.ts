// Content Methods (creator-familiar names)
export type MethodKey =
  | "AUTO"
  | "FOUNDERS"
  | "PODCAST"
  | "DISCOVERY"
  | "CAMERA_PUT_DOWN"
  | "SENSORY"
  | "DELAYED_GRATIFICATION";

// Legacy preset keys (backwards compatibility)
export type LegacyPresetKey =
  | "RAW_UGC_V1"
  | "TIKTOK_AD_V1"
  | "PODCAST_V1"
  | "SENSORY_V1"
  | "CLEAN_V1"
  | "STORY_V1"
  | "HOOK_V1"
  | "MINIMAL_V1";

// Combined type for all valid preset/method keys
export type PresetKey = MethodKey | LegacyPresetKey;

export type BatchMode = "hook_test" | "angle_test" | "format_test";
export type BatchSize = 2 | 4 | 6 | 8;
export type BatchStatus = "queued" | "researching" | "running" | "done" | "failed" | "cancelled";
export type OutputType = "video" | "image";
export type ImageType = "product" | "lifestyle" | "ad" | "ugc" | "hero" | "custom";
export type AdFormat = "ugc_testimonial" | "problem_solution" | "before_after" | "founder_pov" | "product_demo";
export type OutcomeGoal = "conversion" | "awareness" | "retention";
export type ComplianceFlag = "no_medical_claims" | "no_medication_shown" | "no_exaggerated_results";
export type SceneCount = 3 | 4 | 5;

export type ClipStatus =
  | "planned"
  | "scripting"
  | "vo"
  | "rendering"
  | "assembling"
  | "generating"
  | "ready"
  | "failed";

export type ClipUIState =
  | "queued"
  | "writing"
  | "voicing"
  | "submitting"
  | "rendering"
  | "rendering_delayed"
  | "assembling"
  | "ready"
  | "failed_not_charged"
  | "failed_charged"
  | "canceled";

export type ChargedState = "unknown" | "not_charged" | "charged";

export type JobType = "research" | "compile" | "tts" | "video" | "assemble" | "image" | "image_compile";
export type JobStatus = "queued" | "running" | "done" | "failed";

export interface PresetConfig {
  captions?: {
    enabled: boolean;
    style?: string;
  };
  fake_comments?: {
    enabled: boolean;
    variant?: string;
  };
  progress_bar?: {
    enabled: boolean;
  };
  endcard?: {
    enabled: boolean;
    duration_sec?: number;
  };
  zoom?: {
    enabled: boolean;
    cadence_sec?: number;
    min?: number;
    max?: number;
  };
}

export interface Preset {
  id: string;
  key: PresetKey;
  name: string;
  description: string;
  preview_video_url: string | null;
  config_json: PresetConfig;
  is_active: boolean;
  created_at: string;
}

export type PaymentStatus = "pending" | "charged" | "failed" | "refunded" | "free";
export type QualityMode = "fast" | "good" | "better";

// Research context returned by the brain + Apify research step
export interface ResearchContext {
  category?: string;
  category_info?: {
    description: string;
    viral_threshold: number;
  };
  search_query?: string;
  scraped_videos?: Array<{
    id?: string;
    views: number;
    likes?: number;
    shares?: number;
    hook_text?: string;
    caption?: string;
    url?: string;
    author?: string;
  }>;
  trend_analysis?: {
    hook_patterns?: Array<{ pattern: string; frequency: number }>;
    recommended_hooks?: Array<{ hook: string; reasoning: string }>;
    engagement_drivers?: string[];
    content_themes?: string[];
    viral_elements?: string[];
  };
  research_summary?: string;
}

export interface Batch {
  id: string;
  created_at: string;
  updated_at: string;
  intent_text: string;
  preset_key: string;
  mode: BatchMode;
  batch_size: BatchSize;
  status: BatchStatus;
  output_type: OutputType;
  error: string | null;
  // Billing fields
  user_id: string | null;
  quality_mode: QualityMode;
  base_cost_cents: number;
  user_charge_cents: number;
  payment_status: PaymentStatus;
  // Research data from brain + Apify
  research_json?: ResearchContext;
}

export interface OnScreenText {
  t: number;
  text: string;
}

export interface Clip {
  id: string;
  created_at: string;
  updated_at?: string;
  batch_id: string;
  variant_id: string;
  segment_type: string;
  status: ClipStatus;
  ui_state?: ClipUIState | null;
  ui_started_at?: string | null;
  ui_last_progress_at?: string | null;
  ui_message?: string | null;
  provider?: string | null;
  provider_task_id?: string | null;
  charged_state?: ChargedState | null;
  watermark_removal_disabled?: boolean | null;
  script_spoken: string | null;
  on_screen_text_json: OnScreenText[] | null;
  sora_prompt: string | null;
  voice_url: string | null;
  raw_video_url: string | null;
  final_url: string | null;
  // Image-specific fields
  image_type: ImageType | null;
  image_prompt: string | null;
  image_url: string | null;
  aspect_ratio: string | null;
  // Common fields
  preset_key: string;
  winner: boolean;
  killed: boolean;
  error: string | null;
}

export interface Job {
  id: string;
  created_at: string;
  updated_at: string;
  batch_id: string;
  clip_id: string | null;
  type: JobType;
  payload_json: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  error: string | null;
}

export interface GenerateBatchRequest {
  intent_text: string;
  preset_key: PresetKey;
  mode: BatchMode;
  batch_size: BatchSize;
  output_type?: OutputType;
  image_type?: ImageType;
  aspect_ratio?: string;
  video_service?: "sora" | "kling";
  ad_format?: AdFormat;
  outcome_goal?: OutcomeGoal;
  scene_count?: SceneCount;
  compliance?: ComplianceFlag[];
  video_generation_mode?: "ttv" | "i2v";
  reference_images?: {
    product_url?: string;
    person_url?: string;
  };
}

export interface GenerateBatchResponse {
  batch_id: string;
}

// Database types for Supabase
export type Database = {
  public: {
    Tables: {
      presets: {
        Row: Preset;
        Insert: Omit<Preset, "id" | "created_at">;
        Update: Partial<Omit<Preset, "id" | "created_at">>;
      };
      batches: {
        Row: Batch;
        Insert: Omit<Batch, "id" | "created_at">;
        Update: Partial<Omit<Batch, "id" | "created_at">>;
      };
      clips: {
        Row: Clip;
        Insert: Omit<Clip, "id" | "created_at">;
        Update: Partial<Omit<Clip, "id" | "created_at">>;
      };
      jobs: {
        Row: Job;
        Insert: Omit<Job, "id" | "created_at">;
        Update: Partial<Omit<Job, "id" | "created_at">>;
      };
    };
  };
};
