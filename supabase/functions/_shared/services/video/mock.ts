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

  async generateVideo(params: VideoGenerationParams): Promise<VideoOutput> {
    const { clip_id, duration = 15 } = params;
    
    // Simulate API delay (video generation takes longer)
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 600));
    
    // Pick a sample video based on clip_id hash
    const videoIndex = clip_id.charCodeAt(0) % SAMPLE_VIDEOS.length;
    
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
