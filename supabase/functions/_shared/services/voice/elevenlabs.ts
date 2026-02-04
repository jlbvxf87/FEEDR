// FEEDR - ElevenLabs Voice Service
// Uses ElevenLabs API for text-to-speech

import { VoiceService, VoiceOutput, VoiceGenerationParams, VOICE_PRESETS } from "./interface.ts";
import { uploadAudio } from "../storage.ts";

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

export class ElevenLabsVoiceService implements VoiceService {
  readonly name = "elevenlabs";
  private apiKey: string;
  
  readonly availableVoices = [
    { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Calm, conversational female voice" },
    { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Deep, engaging male voice" },
    { id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "Warm, authoritative male voice" },
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", description: "Soft, friendly female voice" },
    { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", description: "Young, energetic female voice" },
    { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", description: "Young, casual male voice" },
  ];

  constructor() {
    this.apiKey = Deno.env.get("ELEVENLABS_API_KEY") || "";
    
    if (!this.apiKey) {
      console.warn("ELEVENLABS_API_KEY not set, ElevenLabs service will fail");
    }
  }

  async generateVoice(params: VoiceGenerationParams): Promise<VoiceOutput> {
    const { script, clip_id, voice_id, speed = 1.0 } = params;
    
    // Use provided voice_id or default
    const selectedVoiceId = voice_id || VOICE_PRESETS.default.elevenlabs;
    
    try {
      const response = await fetch(
        `${ELEVENLABS_API_URL}/text-to-speech/${selectedVoiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": this.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: script,
            model_id: "eleven_turbo_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.5,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
      }

      // Get audio data as ArrayBuffer
      const audioData = await response.arrayBuffer();
      
      // Upload to Supabase Storage
      const voice_url = await uploadAudio(clip_id, audioData);
      
      // Estimate duration (roughly 150 words per minute)
      const wordCount = script.split(/\s+/).length;
      const duration_seconds = Math.round((wordCount / 150) * 60 / speed);

      return {
        voice_url,
        duration_seconds,
      };
      
    } catch (error) {
      console.error("ElevenLabs voice generation failed:", error);
      throw error;
    }
  }
}
