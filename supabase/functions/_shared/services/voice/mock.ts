// FEEDR - Mock Voice Service
// Used for development and testing

import { VoiceService, VoiceOutput, VoiceGenerationParams } from "./interface.ts";

// Placeholder silent audio (base64 encoded minimal MP3)
const PLACEHOLDER_AUDIO_URL = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYNkEsAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYNkEsAAAAAAAAAAAAAAAAA";

export class MockVoiceService implements VoiceService {
  readonly name = "mock";
  
  readonly availableVoices = [
    { id: "mock-voice-1", name: "Mock Voice 1", description: "Default mock voice" },
    { id: "mock-voice-2", name: "Mock Voice 2", description: "Alternative mock voice" },
  ];

  async generateVoice(params: VoiceGenerationParams): Promise<VoiceOutput> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 400));
    
    // Estimate duration from script length (roughly 150 words per minute)
    const wordCount = params.script.split(/\s+/).length;
    const duration_seconds = Math.round((wordCount / 150) * 60);
    
    return {
      voice_url: PLACEHOLDER_AUDIO_URL,
      duration_seconds,
    };
  }
}
