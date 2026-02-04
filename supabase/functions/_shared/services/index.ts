// FEEDR - Service Registry
// Central registry for all AI service implementations

import { ScriptService } from "./script/interface.ts";
import { VoiceService } from "./voice/interface.ts";
import { VideoService } from "./video/interface.ts";
import { ImageService } from "./image/interface.ts";
import { AssemblyService } from "./assembly/interface.ts";
import { ResearchService } from "./research/interface.ts";

// Import mock implementations
import { MockScriptService } from "./script/mock.ts";
import { MockVoiceService } from "./voice/mock.ts";
import { MockVideoService } from "./video/mock.ts";
import { MockAssemblyService } from "./assembly/mock.ts";
import { MockResearchService } from "./research/mock.ts";

// Import real implementations
import { OpenAIScriptService } from "./script/openai.ts";
import { ClaudeScriptService } from "./script/claude.ts";
import { ElevenLabsVoiceService } from "./voice/elevenlabs.ts";
import { OpenAITTSService } from "./voice/openai-tts.ts";
import { SoraVideoService } from "./video/sora.ts";
import { RunwayVideoService } from "./video/runway.ts";
import { ApifyResearchService } from "./research/apify.ts";
import { FFmpegAssemblyService } from "./assembly/ffmpeg.ts";

// Import image implementations
import { MockImageService } from "./image/mock.ts";
import { DalleImageService } from "./image/dalle.ts";
import { FluxImageService } from "./image/flux.ts";

// Service type identifiers
export type ServiceType = "script" | "voice" | "video" | "image" | "assembly" | "research";

// Available service implementations
export type ScriptServiceName = "mock" | "openai" | "claude";
export type VoiceServiceName = "mock" | "elevenlabs" | "openai";
export type VideoServiceName = "mock" | "sora" | "runway";
export type ImageServiceName = "mock" | "dalle" | "flux" | "midjourney";
export type AssemblyServiceName = "mock" | "ffmpeg";
export type ResearchServiceName = "mock" | "apify";

/**
 * Service Registry - Creates and manages AI service instances
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry;
  
  private scriptService: ScriptService | null = null;
  private voiceService: VoiceService | null = null;
  private videoService: VideoService | null = null;
  private imageService: ImageService | null = null;
  private assemblyService: AssemblyService | null = null;
  private researchService: ResearchService | null = null;

  private constructor() {}

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /**
   * Get script generation service
   */
  getScriptService(): ScriptService {
    if (!this.scriptService) {
      const serviceName = Deno.env.get("SCRIPT_SERVICE") || "mock";
      this.scriptService = this.createScriptService(serviceName as ScriptServiceName);
    }
    return this.scriptService;
  }

  /**
   * Get voice generation service
   */
  getVoiceService(): VoiceService {
    if (!this.voiceService) {
      const serviceName = Deno.env.get("VOICE_SERVICE") || "mock";
      this.voiceService = this.createVoiceService(serviceName as VoiceServiceName);
    }
    return this.voiceService;
  }

  /**
   * Get video generation service
   */
  getVideoService(): VideoService {
    if (!this.videoService) {
      const serviceName = Deno.env.get("VIDEO_SERVICE") || "mock";
      this.videoService = this.createVideoService(serviceName as VideoServiceName);
    }
    return this.videoService;
  }

  /**
   * Get image generation service
   */
  getImageService(): ImageService {
    if (!this.imageService) {
      const serviceName = Deno.env.get("IMAGE_SERVICE") || "mock";
      this.imageService = this.createImageService(serviceName as ImageServiceName);
    }
    return this.imageService;
  }

  /**
   * Get assembly service
   */
  getAssemblyService(): AssemblyService {
    if (!this.assemblyService) {
      const serviceName = Deno.env.get("ASSEMBLY_SERVICE") || "mock";
      this.assemblyService = this.createAssemblyService(serviceName as AssemblyServiceName);
    }
    return this.assemblyService;
  }

  /**
   * Get research service
   */
  getResearchService(): ResearchService {
    if (!this.researchService) {
      const serviceName = Deno.env.get("RESEARCH_SERVICE") || "mock";
      this.researchService = this.createResearchService(serviceName as ResearchServiceName);
    }
    return this.researchService;
  }

  /**
   * Get all current service names (for logging/tracking)
   */
  getServiceConfig(): Record<ServiceType, string> {
    return {
      script: this.getScriptService().name,
      voice: this.getVoiceService().name,
      video: this.getVideoService().name,
      image: this.getImageService().name,
      assembly: this.getAssemblyService().name,
      research: this.getResearchService().name,
    };
  }

  // Factory methods for creating service instances

  private createScriptService(name: ScriptServiceName): ScriptService {
    switch (name) {
      case "openai":
        return new OpenAIScriptService();
      case "claude":
        return new ClaudeScriptService();
      case "mock":
      default:
        return new MockScriptService();
    }
  }

  private createVoiceService(name: VoiceServiceName): VoiceService {
    switch (name) {
      case "elevenlabs":
        return new ElevenLabsVoiceService();
      case "openai":
        return new OpenAITTSService();
      case "mock":
      default:
        return new MockVoiceService();
    }
  }

  private createVideoService(name: VideoServiceName): VideoService {
    switch (name) {
      case "sora":
        return new SoraVideoService();
      case "runway":
        return new RunwayVideoService();
      case "mock":
      default:
        return new MockVideoService();
    }
  }

  private createImageService(name: ImageServiceName): ImageService {
    switch (name) {
      case "dalle":
        return new DalleImageService();
      case "flux":
        return new FluxImageService();
      case "midjourney":
        // Midjourney doesn't have a direct API, would need a proxy service
        console.warn("Midjourney not directly supported, falling back to DALL-E");
        return new DalleImageService();
      case "mock":
      default:
        return new MockImageService();
    }
  }

  private createAssemblyService(name: AssemblyServiceName): AssemblyService {
    switch (name) {
      case "ffmpeg":
        return new FFmpegAssemblyService();
      case "mock":
      default:
        return new MockAssemblyService();
    }
  }

  private createResearchService(name: ResearchServiceName): ResearchService {
    switch (name) {
      case "apify":
        return new ApifyResearchService();
      case "mock":
      default:
        return new MockResearchService();
    }
  }
}

// Export singleton instance getter
export function getServices(): ServiceRegistry {
  return ServiceRegistry.getInstance();
}

// Re-export interfaces for convenience
export * from "./script/interface.ts";
export * from "./voice/interface.ts";
export * from "./video/interface.ts";
export * from "./image/interface.ts";
export * from "./assembly/interface.ts";
export * from "./research/interface.ts";
