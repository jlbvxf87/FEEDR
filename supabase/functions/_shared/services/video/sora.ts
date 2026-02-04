// FEEDR - Sora Video Service (KEIAPI)
// Uses KEIAPI for Sora video generation

import { VideoService, VideoOutput, VideoGenerationParams, VIDEO_STYLE_PROMPTS } from "./interface.ts";
import { uploadVideo } from "../storage.ts";

export class SoraVideoService implements VideoService {
  readonly name = "sora";
  readonly maxDuration = 60;
  readonly supportedAspectRatios = ["9:16", "16:9", "1:1"];
  
  private apiKey: string;
  private apiEndpoint: string;

  constructor() {
    this.apiKey = Deno.env.get("KEIAPI_API_KEY") || "";
    this.apiEndpoint = Deno.env.get("KEIAPI_ENDPOINT") || "https://api.keiapi.com/v1";
    
    if (!this.apiKey) {
      console.warn("KEIAPI_API_KEY not set, Sora service will fail");
    }
  }

  async generateVideo(params: VideoGenerationParams): Promise<VideoOutput> {
    const { prompt, clip_id, duration = 15, aspect_ratio = "9:16" } = params;
    
    try {
      // 1. Submit generation request
      const submitResponse = await fetch(`${this.apiEndpoint}/sora/generate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt,
          duration: duration,
          aspect_ratio: aspect_ratio,
          quality: "high",
        }),
      });

      if (!submitResponse.ok) {
        const error = await submitResponse.text();
        throw new Error(`KEIAPI submit error: ${submitResponse.status} - ${error}`);
      }

      const { job_id } = await submitResponse.json();
      
      // 2. Poll for completion (Sora can take 2-10 minutes)
      let attempts = 0;
      const maxAttempts = 120; // 10 minutes with 5s intervals
      let result: { video_url: string } | null = null;
      
      while (!result && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000)); // 5s polling
        attempts++;
        
        const statusResponse = await fetch(`${this.apiEndpoint}/sora/status/${job_id}`, {
          headers: { "Authorization": `Bearer ${this.apiKey}` },
        });

        if (!statusResponse.ok) {
          console.warn(`Status check failed, attempt ${attempts}`);
          continue;
        }

        const status = await statusResponse.json();
        
        if (status.state === "completed" && status.video_url) {
          result = { video_url: status.video_url };
        } else if (status.state === "failed") {
          throw new Error(`Sora generation failed: ${status.error || "Unknown error"}`);
        }
        // Continue polling if still processing
      }

      if (!result) {
        throw new Error("Sora generation timed out");
      }

      // 3. Download video and upload to Supabase Storage
      const videoResponse = await fetch(result.video_url);
      if (!videoResponse.ok) {
        throw new Error("Failed to download generated video");
      }
      
      const videoData = await videoResponse.arrayBuffer();
      const raw_video_url = await uploadVideo("raw", clip_id, videoData);

      return {
        raw_video_url,
        duration_seconds: duration,
        width: aspect_ratio === "9:16" ? 1080 : (aspect_ratio === "1:1" ? 1080 : 1920),
        height: aspect_ratio === "9:16" ? 1920 : (aspect_ratio === "1:1" ? 1080 : 1080),
      };
      
    } catch (error) {
      console.error("Sora video generation failed:", error);
      throw error;
    }
  }

  async checkStatus(jobId: string): Promise<{
    status: "pending" | "processing" | "completed" | "failed";
    progress?: number;
    result?: VideoOutput;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.apiEndpoint}/sora/status/${jobId}`, {
        headers: { "Authorization": `Bearer ${this.apiKey}` },
      });

      if (!response.ok) {
        return { status: "failed", error: "Failed to check status" };
      }

      const data = await response.json();
      
      const statusMap: Record<string, "pending" | "processing" | "completed" | "failed"> = {
        "queued": "pending",
        "processing": "processing",
        "completed": "completed",
        "failed": "failed",
      };

      return {
        status: statusMap[data.state] || "processing",
        progress: data.progress,
        result: data.video_url ? {
          raw_video_url: data.video_url,
          duration_seconds: data.duration,
        } : undefined,
        error: data.error,
      };
    } catch (error) {
      return { status: "failed", error: String(error) };
    }
  }
}
