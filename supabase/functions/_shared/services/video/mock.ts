// FEEDR - Mock Video Service
// Used for development and testing

import { VideoService, VideoOutput, VideoGenerationParams } from "./interface.ts";

// Sample video URLs for mock rendering
const SAMPLE_VIDEOS = [
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
];

export class MockVideoService implements VideoService {
  readonly name = "mock";
  readonly maxDuration = 60;
  readonly supportedAspectRatios = ["9:16", "16:9", "1:1"];

  async submitVideo(params: VideoGenerationParams): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return `mock-task-${Date.now()}`;
  }

  async downloadAndUploadVideo(videoUrl: string, clipId: string): Promise<VideoOutput> {
    return {
      raw_video_url: videoUrl,
      duration_seconds: 15,
      width: 1080,
      height: 1920,
    };
  }

  async generateVideo(params: VideoGenerationParams): Promise<VideoOutput> {
    const { prompt, clip_id, duration = 15 } = params;
    
    // Simulate API delay (video generation takes longer)
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 600));
    
    // Pick sample video based on prompt + clip_id so different prompts get different videos
    const hash = (prompt || "").split("").reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0);
    const videoIndex = Math.abs(hash + clip_id.charCodeAt(0)) % SAMPLE_VIDEOS.length;
    
    return {
      raw_video_url: SAMPLE_VIDEOS[videoIndex],
      duration_seconds: duration,
      width: 1080,
      height: 1920,
    };
  }

  async checkStatus(jobId: string): Promise<{
    status: "pending" | "processing" | "completed" | "failed";
    progress?: number;
    result?: VideoOutput;
    error?: string;
  }> {
    // Mock always returns completed
    return {
      status: "completed",
      progress: 100,
      result: {
        raw_video_url: SAMPLE_VIDEOS[0],
        duration_seconds: 15,
        width: 1080,
        height: 1920,
      },
    };
  }
}
