// FEEDR - Runway ML Video Service
// Uses Runway ML API for video generation (Gen-3 Alpha)

import { VideoService, VideoOutput, VideoGenerationParams } from "./interface.ts";
import { uploadVideo } from "../storage.ts";

const RUNWAY_API_URL = "https://api.runwayml.com/v1";

export class RunwayVideoService implements VideoService {
  readonly name = "runway";
  readonly maxDuration = 10; // Runway Gen-3 currently supports up to 10s
  readonly supportedAspectRatios = ["9:16", "16:9", "1:1"];
  
  private apiKey: string;

  constructor() {
    this.apiKey = Deno.env.get("RUNWAY_API_KEY") || "";
    
    if (!this.apiKey) {
      console.warn("RUNWAY_API_KEY not set, Runway service will fail");
    }
  }

  async generateVideo(params: VideoGenerationParams): Promise<VideoOutput> {
    const { prompt, clip_id, duration = 10, aspect_ratio = "9:16" } = params;
    
    // Runway Gen-3 max duration is 10s
    const actualDuration = Math.min(duration, this.maxDuration);
    
    try {
      // 1. Create generation task
      const createResponse = await fetch(`${RUNWAY_API_URL}/image_to_video`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "X-Runway-Version": "2024-11-06",
        },
        body: JSON.stringify({
          model: "gen3a_turbo",
          promptText: prompt,
          duration: actualDuration,
          ratio: aspect_ratio.replace(":", ":"), // Runway uses same format
          watermark: false,
        }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.text();
        throw new Error(`Runway create error: ${createResponse.status} - ${error}`);
      }

      const { id: taskId } = await createResponse.json();
      
      // 2. Poll for completion
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes with 5s intervals
      let result: { video_url: string } | null = null;
      
      while (!result && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000));
        attempts++;
        
        const statusResponse = await fetch(`${RUNWAY_API_URL}/tasks/${taskId}`, {
          headers: { "Authorization": `Bearer ${this.apiKey}` },
        });

        if (!statusResponse.ok) {
          console.warn(`Runway status check failed, attempt ${attempts}`);
          continue;
        }

        const status = await statusResponse.json();
        
        if (status.status === "SUCCEEDED" && status.output?.[0]) {
          result = { video_url: status.output[0] };
        } else if (status.status === "FAILED") {
          throw new Error(`Runway generation failed: ${status.failure || "Unknown error"}`);
        }
      }

      if (!result) {
        throw new Error("Runway generation timed out");
      }

      // 3. Download and upload to Supabase
      const videoResponse = await fetch(result.video_url);
      if (!videoResponse.ok) {
        throw new Error("Failed to download Runway video");
      }
      
      const videoData = await videoResponse.arrayBuffer();
      const raw_video_url = await uploadVideo("raw", clip_id, videoData);

      return {
        raw_video_url,
        duration_seconds: actualDuration,
        width: aspect_ratio === "9:16" ? 768 : (aspect_ratio === "1:1" ? 768 : 1280),
        height: aspect_ratio === "9:16" ? 1280 : (aspect_ratio === "1:1" ? 768 : 768),
      };
      
    } catch (error) {
      console.error("Runway video generation failed:", error);
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
      const response = await fetch(`${RUNWAY_API_URL}/tasks/${jobId}`, {
        headers: { "Authorization": `Bearer ${this.apiKey}` },
      });

      if (!response.ok) {
        return { status: "failed", error: "Failed to check status" };
      }

      const data = await response.json();
      
      const statusMap: Record<string, "pending" | "processing" | "completed" | "failed"> = {
        "PENDING": "pending",
        "RUNNING": "processing",
        "SUCCEEDED": "completed",
        "FAILED": "failed",
      };

      return {
        status: statusMap[data.status] || "processing",
        progress: data.progress,
        result: data.output?.[0] ? {
          raw_video_url: data.output[0],
          duration_seconds: data.duration || 10,
        } : undefined,
        error: data.failure,
      };
    } catch (error) {
      return { status: "failed", error: String(error) };
    }
  }
}
