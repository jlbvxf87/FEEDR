// FEEDR - Mock Assembly Service
// Used for development and testing

import { AssemblyService, AssemblyOutput, AssemblyParams } from "./interface.ts";

export class MockAssemblyService implements AssemblyService {
  readonly name = "mock";

  async assembleVideo(params: AssemblyParams): Promise<AssemblyOutput> {
    const { raw_video_url } = params;
    
    // Simulate API delay (assembly takes time)
    await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 500));
    
    // In mock mode, just return the raw video as the final
    // Real implementation would combine video + audio + overlays
    return {
      final_url: raw_video_url,
      duration_seconds: 15,
    };
  }
}
