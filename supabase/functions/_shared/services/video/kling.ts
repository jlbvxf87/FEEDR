// FEEDR - Kling 2.6 Video Service (KIE.AI)
// Uses KIE.AI unified jobs API for Kling 2.6 text-to-video
// Docs: https://docs.kie.ai/market/kling/text-to-video

import { VideoService, VideoOutput, VideoGenerationParams } from "./interface.ts";
import { uploadVideo } from "../../storage.ts";

const KIE_API_BASE = "https://api.kie.ai/api/v1";

export class KlingVideoService implements VideoService {
  readonly name = "kling";
  readonly maxDuration = 10; // Kling 2.6 text-to-video supports short clips (docs use 5s/10s)
  readonly supportedAspectRatios = ["9:16", "16:9", "1:1"];

  private apiKey: string;

  constructor() {
    this.apiKey = Deno.env.get("KIE_API_KEY") || Deno.env.get("KEIAPI_API_KEY") || "";
    if (!this.apiKey) {
      console.warn("KIE_API_KEY not set, Kling service will fail");
    }
  }

  async submitVideo(params: VideoGenerationParams): Promise<string> {
    const { prompt, duration = 5, aspect_ratio = "9:16" } = params;

    const submitResponse = await fetch(`${KIE_API_BASE}/jobs/createTask`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "kling-2.6/text-to-video",
        input: {
          prompt,
          sound: false,
          aspect_ratio,
          duration: String(Math.min(duration, this.maxDuration)),
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
    return taskId;
  }

  async checkStatus(taskId: string): Promise<{ status: "pending" | "processing" | "completed" | "failed"; result?: VideoOutput; error?: string }> {
    const statusResponse = await fetch(
      `${KIE_API_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
      {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
        },
      }
    );

    if (!statusResponse.ok) {
      const error = await statusResponse.text();
      throw new Error(`KIE.AI status error: ${statusResponse.status} - ${error}`);
    }

    const statusData = await statusResponse.json();
    const state = statusData.data?.state || statusData.data?.status;

    if (state === "success" || state === "completed") {
      const url = statusData.data?.result?.video_url || statusData.data?.video_url || statusData.data?.result?.url;
      if (!url) {
        return { status: "failed", error: "KIE.AI completed but no video URL returned" };
      }
      return { status: "completed", result: { raw_video_url: url } };
    }

    if (state === "failed" || state === "error") {
      return { status: "failed", error: statusData.data?.error || statusData.msg || "Unknown error" };
    }

    return { status: "processing" };
  }

  async downloadAndUploadVideo(videoUrl: string, clipId: string): Promise<VideoOutput> {
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error("Failed to download generated video from KIE.AI");
    }
    const videoData = await videoResponse.arrayBuffer();
    const raw_video_url = await uploadVideo("raw", clipId, videoData);
    return { raw_video_url };
  }

  async generateVideo(params: VideoGenerationParams): Promise<VideoOutput> {
    const taskId = await this.submitVideo(params);
    // Fallback synchronous path: poll until completion
    for (let i = 0; i < 60; i++) {
      const status = await this.checkStatus(taskId);
      if (status.status === "completed" && status.result?.raw_video_url) {
        return this.downloadAndUploadVideo(status.result.raw_video_url, params.clip_id);
      }
      if (status.status === "failed") {
        throw new Error(`Kling generation failed: ${status.error || "Unknown error"}`);
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error("Kling generation timed out");
  }
}
