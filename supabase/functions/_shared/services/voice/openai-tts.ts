// FEEDR - OpenAI TTS Voice Service
// Uses OpenAI's text-to-speech API

import { VoiceService, VoiceOutput, VoiceGenerationParams, VOICE_PRESETS } from "./interface.ts";
import { uploadAudio } from "../storage.ts";

const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";

export class OpenAITTSService implements VoiceService {
  readonly name = "openai-tts";
  private apiKey: string;
  
  readonly availableVoices = [
    { id: "alloy", name: "Alloy", description: "Neutral, balanced voice" },
    { id: "echo", name: "Echo", description: "Warm, conversational voice" },
    { id: "fable", name: "Fable", description: "Expressive, narrative voice" },
    { id: "onyx", name: "Onyx", description: "Deep, authoritative voice" },
    { id: "nova", name: "Nova", description: "Friendly, upbeat voice" },
    { id: "shimmer", name: "Shimmer", description: "Clear, professional voice" },
  ];

  constructor() {
    this.apiKey = Deno.env.get("OPENAI_API_KEY") || "";
    
    if (!this.apiKey) {
      console.warn("OPENAI_API_KEY not set, OpenAI TTS service will fail");
    }
  }

  async generateVoice(params: VoiceGenerationParams): Promise<VoiceOutput> {
    const { script, clip_id, voice_id, speed = 1.0 } = params;
    
    // Use provided voice_id or default
    const selectedVoice = voice_id || VOICE_PRESETS.default.openai;
    
    try {
      const response = await fetch(OPENAI_TTS_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1-hd",
          input: script,
          voice: selectedVoice,
          speed: speed,
          response_format: "mp3",
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI TTS API error: ${response.status} - ${error}`);
      }

      // Get audio data as ArrayBuffer
      const audioData = await response.arrayBuffer();
      
      // Upload to Supabase Storage
      const voice_url = await uploadAudio(clip_id, audioData);
      
      // Estimate duration (roughly 150 words per minute, adjusted for speed)
      const wordCount = script.split(/\s+/).length;
      const duration_seconds = Math.round((wordCount / 150) * 60 / speed);

      return {
        voice_url,
        duration_seconds,
      };
      
    } catch (error) {
      console.error("OpenAI TTS generation failed:", error);
      throw error;
    }
  }
}
