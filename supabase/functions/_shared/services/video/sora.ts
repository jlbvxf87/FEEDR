// FEEDR - Sora Video Service (KIE.AI)
// Uses KIE.AI for Sora 2 Pro video generation
// Docs: https://kie.ai/sora-2-pro

import { VideoService, VideoOutput, VideoGenerationParams, VIDEO_STYLE_PROMPTS } from "./interface.ts";
import { uploadVideo } from "../../storage.ts";

const KIE_API_BASE = "https://api.kie.ai/v1";

export class SoraVideoService implements VideoService {
  readonly name = "sora";
  readonly maxDuration = 15; // Sora 2 Pro supports up to 15 seconds
  readonly supportedAspectRatios = ["9:16", "16:9"];
  
  private apiKey: string;

  constructor() {
    this.apiKey = Deno.env.get("KIE_API_KEY") || Deno.env.get("KEIAPI_API_KEY") || "";
    
    if (!this.apiKey) {
      console.warn("KIE_API_KEY not set, Sora service will fail");
    }
  }

  async generateVideo(params: VideoGenerationParams): Promise<VideoOutput> {
    const { prompt, clip_id, duration = 15, aspect_ratio = "9:16" } = params;
    
    try {
      // Map aspect ratio to KIE.AI format
      const kieAspectRatio = aspect_ratio === "9:16" ? "portrait" : "landscape";
      
      // Map duration to n_frames (KIE.AI uses "10" or "15" as strings)
      const nFrames = duration <= 10 ? "10" : "15";
      
      console.log(`Submitting to KIE.AI Sora 2 Pro: ${prompt.substring(0, 50)}...`);
      
      // 1. Submit generation request to KIE.AI
      const submitResponse = await fetch(`${KIE_API_BASE}/sora2-pro/text-to-video`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt,
          aspect_ratio: kieAspectRatio,
          n_frames: nFrames,
          size: "high", // 1080p HD
          remove_watermark: true,
        }),
      });

      if (!submitResponse.ok) {
        const error = await submitResponse.text();
        throw new Error(`KIE.AI submit error: ${submitResponse.status} - ${error}`);
      }

      const submitData = await submitResponse.json();
      const taskId = submitData.data?.task_id || submitData.task_id || submitData.id;
      
      if (!taskId) {
        throw new Error(`KIE.AI response missing task_id: ${JSON.stringify(submitData)}`);
      }
      
      console.log(`KIE.AI task started: ${taskId}`);
      
      // 2. Poll for completion (Sora 2 Pro typically takes 1-5 minutes)
      let attempts = 0;
      const maxAttempts = 120; // 10 minutes with 5s intervals
      let result: { video_url: string } | null = null;
      
      while (!result && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000)); // 5s polling
        attempts++;
        
        const statusResponse = await fetch(`${KIE_API_BASE}/tasks/${taskId}`, {
          headers: { "Authorization": `Bearer ${this.apiKey}` },
        });

        if (!statusResponse.ok) {
          console.warn(`KIE.AI status check failed, attempt ${attempts}`);
          continue;
        }

        const statusData = await statusResponse.json();
        const status = statusData.data?.status || statusData.status;
        
        console.log(`KIE.AI task ${taskId} status: ${status} (attempt ${attempts})`);
        
        if (status === "completed" || status === "succeeded" || status === "success") {
          const videoUrl = statusData.data?.output?.video_url || 
                          statusData.data?.video_url || 
                          statusData.output?.video_url ||
                          statusData.video_url;
          if (videoUrl) {
            result = { video_url: videoUrl };
          }
        } else if (status === "failed" || status === "error") {
          const errorMsg = statusData.data?.error || statusData.error || "Unknown error";
          throw new Error(`Sora generation failed: ${errorMsg}`);
        }
        // Continue polling if still processing
      }

      if (!result) {
        throw new Error("Sora generation timed out after 10 minutes");
      }

      console.log(`KIE.AI video ready: ${result.video_url}`);

      // 3. Download video and upload to Supabase Storage
      const videoResponse = await fetch(result.video_url);
      if (!videoResponse.ok) {
        throw new Error("Failed to download generated video from KIE.AI");
      }
      
      const videoData = await videoResponse.arrayBuffer();
      const raw_video_url = await uploadVideo("raw", clip_id, videoData);

      const actualDuration = nFrames === "15" ? 15 : 10;
      
      return {
        raw_video_url,
        duration_seconds: actualDuration,
        width: kieAspectRatio === "portrait" ? 1080 : 1920,
        height: kieAspectRatio === "portrait" ? 1920 : 1080,
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
      const response = await fetch(`${KIE_API_BASE}/tasks/${jobId}`, {
        headers: { "Authorization": `Bearer ${this.apiKey}` },
      });

      if (!response.ok) {
        return { status: "failed", error: "Failed to check status" };
      }

      const data = await response.json();
      const status = data.data?.status || data.status;
      
      const statusMap: Record<string, "pending" | "processing" | "completed" | "failed"> = {
        "pending": "pending",
        "queued": "pending",
        "processing": "processing",
        "running": "processing",
        "completed": "completed",
        "succeeded": "completed",
        "success": "completed",
        "failed": "failed",
        "error": "failed",
      };

      const videoUrl = data.data?.output?.video_url || data.data?.video_url || data.video_url;

      return {
        status: statusMap[status] || "processing",
        progress: data.data?.progress || data.progress,
        result: videoUrl ? {
          raw_video_url: videoUrl,
          duration_seconds: 15,
        } : undefined,
        error: data.data?.error || data.error,
      };
    } catch (error) {
      return { status: "failed", error: String(error) };
    }
  }
}
