// FEEDR - Service Registry
// Central registry for all AI service implementations
// All services default to production — no mock fallbacks

import { ScriptService } from "./script/interface.ts";
import { VoiceService } from "./voice/interface.ts";
import { VideoService } from "./video/interface.ts";
import { ImageService } from "./image/interface.ts";
import { AssemblyService } from "./assembly/interface.ts";
import { ResearchService } from "./research/interface.ts";

// Import production implementations
import { OpenAIScriptService } from "./script/openai.ts";
import { ClaudeScriptService } from "./script/claude.ts";
import { ElevenLabsVoiceService } from "./voice/elevenlabs.ts";
import { OpenAITTSService } from "./voice/openai-tts.ts";
import { SoraVideoService } from "./video/sora.ts";
import { KlingVideoService } from "./video/kling.ts";
import { ApifyResearchService } from "./research/apify.ts";
import { ShotstackAssemblyService } from "./assembly/shotstack.ts";
import { DalleImageService } from "./image/dalle.ts";

// Service type identifiers
export type ServiceType = "script" | "voice" | "video" | "image" | "assembly" | "research";

// Available service implementations
export type ScriptServiceName = "openai" | "claude";
export type VoiceServiceName = "elevenlabs" | "openai";
export type VideoServiceName = "sora" | "kling";
export type ImageServiceName = "dalle";
export type AssemblyServiceName = "shotstack";
export type ResearchServiceName = "apify";

/**
 * Service Registry - Creates and manages AI service instances
 * All services use production implementations. No mock fallbacks.
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
   * Default: claude (best quality). Alternative: openai
   */
  getScriptService(): ScriptService {
    if (!this.scriptService) {
      const serviceName = Deno.env.get("SCRIPT_SERVICE") || "claude";
      this.scriptService = this.createScriptService(serviceName as ScriptServiceName);
    }
    return this.scriptService;
  }

  /**
   * Get voice generation service
   * Default: elevenlabs. Alternative: openai
   */
  getVoiceService(): VoiceService {
    if (!this.voiceService) {
      const serviceName = Deno.env.get("VOICE_SERVICE") || "elevenlabs";
      this.voiceService = this.createVoiceService(serviceName as VoiceServiceName);
    }
    return this.voiceService;
  }

  /**
   * Get video generation service
   * Default: sora (KIE.AI Sora 2 Pro)
   */
  getVideoService(): VideoService {
    if (!this.videoService) {
      const serviceName = Deno.env.get("VIDEO_SERVICE") || "sora";
      this.videoService = this.createVideoService(serviceName as VideoServiceName);
    }
    return this.videoService;
  }

  /**
   * Get a specific video service by name (no caching)
   */
  getVideoServiceByName(name: VideoServiceName): VideoService {
    return this.createVideoService(name);
  }

  /**
   * Get image generation service
   * Default: dalle
   */
  getImageService(): ImageService {
    if (!this.imageService) {
      const serviceName = Deno.env.get("IMAGE_SERVICE") || "dalle";
      this.imageService = this.createImageService(serviceName as ImageServiceName);
    }
    return this.imageService;
  }

  /**
   * Get assembly service
   * Default: shotstack
   */
  getAssemblyService(): AssemblyService {
    if (!this.assemblyService) {
      const serviceName = Deno.env.get("ASSEMBLY_SERVICE") || "shotstack";
      this.assemblyService = this.createAssemblyService(serviceName as AssemblyServiceName);
    }
    return this.assemblyService;
  }

  /**
   * Get research service
   * Default: apify
   */
  getResearchService(): ResearchService {
    if (!this.researchService) {
      const serviceName = Deno.env.get("RESEARCH_SERVICE") || "apify";
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
      default:
        return new ClaudeScriptService();
    }
  }

  private createVoiceService(name: VoiceServiceName): VoiceService {
    switch (name) {
      case "openai":
        return new OpenAITTSService();
      case "elevenlabs":
      default:
        return new ElevenLabsVoiceService();
    }
  }

  private createVideoService(name: VideoServiceName): VideoService {
    switch (name) {
      case "kling":
        return new KlingVideoService();
      case "sora":
      default:
        return new SoraVideoService();
    }
  }

  private createImageService(_name: ImageServiceName): ImageService {
    return new DalleImageService();
  }

  private createAssemblyService(_name: AssemblyServiceName): AssemblyService {
    return new ShotstackAssemblyService();
  }

  private createResearchService(_name: ResearchServiceName): ResearchService {
    return new ApifyResearchService();
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
