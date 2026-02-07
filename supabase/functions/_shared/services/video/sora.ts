// FEEDR - Sora Video Service (KIE.AI)
// Uses KIE.AI unified jobs API for Sora 2 Pro video generation
// Docs: https://docs.kie.ai/market/sora2/sora-2-pro-text-to-video

import { VideoService, VideoOutput, VideoGenerationParams, VIDEO_STYLE_PROMPTS } from "./interface.ts";
import { uploadVideo } from "../../storage.ts";

// Unified jobs API base — matches docs and watermark remover
const KIE_API_BASE = "https://api.kie.ai/api/v1";

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

  /**
   * Submit a video generation task — returns task_id immediately, no polling.
   * Uses the unified jobs API: POST /api/v1/jobs/createTask
   */
  async submitVideo(params: VideoGenerationParams): Promise<string> {
    const { prompt, duration = 15, aspect_ratio = "9:16", generation_mode, reference_images } = params;

    const kieAspectRatio = aspect_ratio === "9:16" ? "portrait" : "landscape";
    const nFrames = duration <= 10 ? "10" : "15";
    const imageUrls = [reference_images?.product_url, reference_images?.person_url].filter(Boolean) as string[];
    const useI2V = generation_mode === "i2v" && imageUrls.length > 0;
    const model = useI2V ? "sora-2-pro-image-to-video" : "sora-2-pro-text-to-video";

    console.log(`[Sora Submit] Submitting to KIE.AI (${useI2V ? "I2V" : "TTV"}): ${prompt.substring(0, 50)}...`);

    const submitResponse = await fetch(`${KIE_API_BASE}/jobs/createTask`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: {
          prompt,
          aspect_ratio: kieAspectRatio,
          n_frames: nFrames,
          size: useI2V ? "standard" : "high",
          remove_watermark: true,
          ...(useI2V ? { image_urls: imageUrls } : {}),
        },
      }),
    });

    if (!submitResponse.ok) {
      const error = await submitResponse.text();
      throw new Error(`KIE.AI submit error: ${submitResponse.status} - ${error}`);
    }

    const submitData = await submitResponse.json();
    const taskId = submitData.data?.taskId || submitData.data?.task_id;

    if (!taskId) {
      throw new Error(`KIE.AI response missing taskId: ${JSON.stringify(submitData)}`);
    }

    console.log(`[Sora Submit] Task started: ${taskId}`);
    return taskId;
  }

  /**
   * Download a completed video and upload it to Supabase storage.
   */
  async downloadAndUploadVideo(videoUrl: string, clipId: string): Promise<VideoOutput> {
    console.log(`[Sora Download] Downloading video for clip ${clipId}`);

    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error("Failed to download generated video from KIE.AI");
    }

    const videoData = await videoResponse.arrayBuffer();
    const raw_video_url = await uploadVideo("raw", clipId, videoData);

    return {
      raw_video_url,
      duration_seconds: 15,
      width: 1080,
      height: 1920,
    };
  }

  /**
   * Synchronous video generation (submit + internal poll).
   * Fallback path — the async submit+poll in the worker is preferred.
   */
  async generateVideo(params: VideoGenerationParams): Promise<VideoOutput> {
    const { prompt, clip_id, duration = 15, aspect_ratio = "9:16", generation_mode, reference_images } = params;

    try {
      const kieAspectRatio = aspect_ratio === "9:16" ? "portrait" : "landscape";
      const nFrames = duration <= 10 ? "10" : "15";
      const imageUrls = [reference_images?.product_url, reference_images?.person_url].filter(Boolean) as string[];
      const useI2V = generation_mode === "i2v" && imageUrls.length > 0;
      const model = useI2V ? "sora-2-pro-image-to-video" : "sora-2-pro-text-to-video";

      console.log(`Submitting to KIE.AI Sora 2 Pro (${useI2V ? "I2V" : "TTV"}): ${prompt.substring(0, 50)}...`);

      // 1. Submit via unified jobs API
      const submitResponse = await fetch(`${KIE_API_BASE}/jobs/createTask`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: {
            prompt,
            aspect_ratio: kieAspectRatio,
            n_frames: nFrames,
            size: useI2V ? "standard" : "high",
            remove_watermark: true,
            ...(useI2V ? { image_urls: imageUrls } : {}),
          },
        }),
      });

      if (!submitResponse.ok) {
        const error = await submitResponse.text();
        throw new Error(`KIE.AI submit error: ${submitResponse.status} - ${error}`);
      }

      const submitData = await submitResponse.json();
      const taskId = submitData.data?.taskId || submitData.data?.task_id;

      if (!taskId) {
        throw new Error(`KIE.AI response missing taskId: ${JSON.stringify(submitData)}`);
      }

      console.log(`KIE.AI task started: ${taskId}`);

      // 2. Poll for completion via unified recordInfo endpoint
      let attempts = 0;
      const maxAttempts = 120; // 10 minutes with 5s intervals
      let videoUrl: string | null = null;

      while (!videoUrl && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000));
        attempts++;

        const statusResponse = await fetch(
          `${KIE_API_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
          { headers: { "Authorization": `Bearer ${this.apiKey}` } },
        );

        if (!statusResponse.ok) {
          console.warn(`KIE.AI status check failed, attempt ${attempts}`);
          continue;
        }

        const statusData = await statusResponse.json();
        const state = statusData.data?.state || statusData.state;

        console.log(`KIE.AI task ${taskId} state: ${state} (attempt ${attempts})`);

        if (state === "success") {
          videoUrl = this.extractVideoUrl(statusData);
        } else if (state === "fail" || state === "failed" || state === "error") {
          const errorMsg = statusData.data?.failMsg || statusData.data?.error || "Unknown error";
          throw new Error(`Sora generation failed: ${errorMsg}`);
        }
      }

      if (!videoUrl) {
        throw new Error("Sora generation timed out after 10 minutes");
      }

      console.log(`KIE.AI video ready, downloading...`);

      // 3. Download video and upload to Supabase Storage
      const videoResponse = await fetch(videoUrl);
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

  /**
   * Check status of a previously submitted task.
   * Uses unified recordInfo endpoint: GET /api/v1/jobs/recordInfo?taskId=...
   */
  async checkStatus(taskId: string): Promise<{
    status: "pending" | "processing" | "completed" | "failed";
    progress?: number;
    result?: VideoOutput;
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${KIE_API_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
        { headers: { "Authorization": `Bearer ${this.apiKey}` } },
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown");
        console.error(`[Sora Status] Check failed: ${response.status} - ${errorText}`);
        // IMPORTANT: Network/API errors are transient — return "processing" to retry,
        // NOT "failed" which would permanently kill the job
        return { status: "processing", error: `Status check HTTP ${response.status}` };
      }

      const data = await response.json();
      const state = data.data?.state || data.state;

      // Log full response for debugging
      console.log(`[Sora Status] Task ${taskId} raw state: "${state}", full: ${JSON.stringify(data).substring(0, 300)}`);

      // Map KIE unified states to our internal states
      const statusMap: Record<string, "pending" | "processing" | "completed" | "failed"> = {
        "waiting": "pending",
        "queuing": "pending",
        "pending": "pending",
        "queued": "pending",
        "generating": "processing",
        "processing": "processing",
        "running": "processing",
        "success": "completed",
        "completed": "completed",
        "succeeded": "completed",
        "done": "completed",
        "finish": "completed",
        "fail": "failed",
        "failed": "failed",
        "error": "failed",
      };

      const mappedStatus = statusMap[state] || "processing";

      // Warn if we see an unmapped state
      if (state && !statusMap[state]) {
        console.warn(`[Sora Status] Unknown KIE.AI state "${state}", treating as processing`);
      }

      const videoUrl = this.extractVideoUrl(data);

      return {
        status: mappedStatus,
        progress: data.data?.progress || data.progress,
        result: videoUrl ? {
          raw_video_url: videoUrl,
          duration_seconds: 15,
        } : undefined,
        error: data.data?.failMsg || data.data?.error || data.error,
      };
    } catch (error) {
      // Network errors are transient — don't permanently fail, just retry
      console.error(`[Sora Status] Network error checking task ${taskId}:`, error);
      return { status: "processing", error: `Network error: ${String(error)}` };
    }
  }

  /**
   * Extract video URL from KIE unified API response.
   * The resultJson field is a JSON string containing resultUrls array.
   */
  private extractVideoUrl(responseData: any): string | null {
    const d = responseData.data || responseData;

    // Primary: resultJson contains resultUrls array
    if (d.resultJson) {
      try {
        const parsed = typeof d.resultJson === "string"
          ? JSON.parse(d.resultJson)
          : d.resultJson;
        if (Array.isArray(parsed.resultUrls) && parsed.resultUrls.length > 0) {
          return parsed.resultUrls[0];
        }
        if (parsed.video_url) return parsed.video_url;
      } catch {
        // resultJson wasn't valid JSON, try other fields
      }
    }

    // Fallback: direct resultUrls array
    if (Array.isArray(d.resultUrls) && d.resultUrls.length > 0) {
      return d.resultUrls[0];
    }

    // Legacy fallbacks
    return d.output?.video_url || d.video_url || null;
  }
}
