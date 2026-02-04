// FEEDR - Voice Service Interface
// Abstraction layer for text-to-speech (ElevenLabs, OpenAI TTS, etc.)

export interface VoiceOutput {
  voice_url: string;
  duration_seconds?: number;
}

export interface VoiceGenerationParams {
  script: string;
  clip_id: string;
  voice_id?: string;
  speed?: number; // 0.5 to 2.0
}

export interface VoiceService {
  /** Service identifier */
  readonly name: string;
  
  /** Available voice IDs for this service */
  readonly availableVoices: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  
  /**
   * Generate voice audio from script text
   * Returns URL to audio file in storage
   */
  generateVoice(params: VoiceGenerationParams): Promise<VoiceOutput>;
}

// Voice presets for different content styles
export const VOICE_PRESETS = {
  // Energetic, upbeat voice for hooks
  energetic: {
    elevenlabs: "pNInz6obpgDQGcFmaJgB", // Adam
    openai: "nova",
  },
  // Calm, authoritative voice for educational
  authoritative: {
    elevenlabs: "ErXwobaYiN019PkySvjV", // Antoni
    openai: "onyx",
  },
  // Friendly, conversational voice for UGC
  conversational: {
    elevenlabs: "21m00Tcm4TlvDq8ikWAM", // Rachel
    openai: "alloy",
  },
  // Default
  default: {
    elevenlabs: "21m00Tcm4TlvDq8ikWAM",
    openai: "alloy",
  },
} as const;
