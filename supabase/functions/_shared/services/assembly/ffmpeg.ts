// FEEDR - FFmpeg Assembly Service
// Uses a cloud FFmpeg service for video assembly

import { AssemblyService, AssemblyOutput, AssemblyParams, OverlayConfig } from "./interface.ts";
import { uploadVideo, downloadFile } from "../../storage.ts";

export class FFmpegAssemblyService implements AssemblyService {
  readonly name = "ffmpeg";
  
  private ffmpegEndpoint: string;
  private ffmpegApiKey: string;

  constructor() {
    // This would be a cloud FFmpeg service like:
    // - Shotstack API
    // - Creatomate API
    // - Self-hosted FFmpeg worker
    this.ffmpegEndpoint = Deno.env.get("FFMPEG_ENDPOINT") || "";
    this.ffmpegApiKey = Deno.env.get("FFMPEG_API_KEY") || "";
    
    if (!this.ffmpegEndpoint) {
      console.warn("FFMPEG_ENDPOINT not set, FFmpeg service will use passthrough mode");
    }
  }

  async assembleVideo(params: AssemblyParams): Promise<AssemblyOutput> {
    const { 
      clip_id, 
      raw_video_url, 
      voice_url, 
      on_screen_text_json, 
      preset_key,
      overlay_config 
    } = params;

    // If no FFmpeg endpoint configured, use passthrough mode
    if (!this.ffmpegEndpoint) {
      return this.passthroughAssembly(clip_id, raw_video_url);
    }

    try {
      // Build FFmpeg composition request
      const composition = this.buildComposition({
        raw_video_url,
        voice_url,
        on_screen_text_json,
        overlay_config,
      });

      // Submit to FFmpeg service
      const response = await fetch(`${this.ffmpegEndpoint}/render`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.ffmpegApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(composition),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`FFmpeg API error: ${response.status} - ${error}`);
      }

      const { job_id } = await response.json();

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes
      let result: { video_url: string; duration: number } | null = null;

      while (!result && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000));
        attempts++;

        const statusResponse = await fetch(
          `${this.ffmpegEndpoint}/status/${job_id}`,
          { headers: { "Authorization": `Bearer ${this.ffmpegApiKey}` } }
        );

        if (!statusResponse.ok) continue;

        const status = await statusResponse.json();

        if (status.state === "completed" && status.output_url) {
          result = { video_url: status.output_url, duration: status.duration || 15 };
        } else if (status.state === "failed") {
          throw new Error(`FFmpeg assembly failed: ${status.error}`);
        }
      }

      if (!result) {
        throw new Error("FFmpeg assembly timed out");
      }

      // Download and upload to our storage
      const videoData = await downloadFile(result.video_url);
      const final_url = await uploadVideo("final", clip_id, videoData);

      return {
        final_url,
        duration_seconds: result.duration,
      };

    } catch (error) {
      console.error("FFmpeg assembly failed:", error);
      // Fallback to passthrough
      return this.passthroughAssembly(clip_id, raw_video_url);
    }
  }

  // Passthrough mode - just use raw video as final
  private async passthroughAssembly(
    clip_id: string, 
    raw_video_url: string
  ): Promise<AssemblyOutput> {
    // In passthrough mode, we just copy the raw video to final
    // This is useful for development when no FFmpeg service is available
    
    try {
      const videoData = await downloadFile(raw_video_url);
      const final_url = await uploadVideo("final", clip_id, videoData);
      
      return {
        final_url,
        duration_seconds: 15, // Default duration
      };
    } catch {
      // If download fails, just use the raw URL directly
      return {
        final_url: raw_video_url,
        duration_seconds: 15,
      };
    }
  }

  // Build FFmpeg composition configuration
  private buildComposition(params: {
    raw_video_url: string;
    voice_url: string;
    on_screen_text_json: Array<{ t: number; text: string }>;
    overlay_config: OverlayConfig;
  }) {
    const { raw_video_url, voice_url, on_screen_text_json, overlay_config } = params;

    // This structure would match whatever cloud FFmpeg service you're using
    // Example structure for a service like Shotstack or Creatomate
    const composition: any = {
      output: {
        format: "mp4",
        resolution: "1080x1920",
        fps: 30,
      },
      timeline: {
        background: "#000000",
        tracks: [
          // Video track
          {
            clips: [{
              asset: {
                type: "video",
                src: raw_video_url,
              },
              start: 0,
              length: "auto",
            }],
          },
          // Audio track
          {
            clips: [{
              asset: {
                type: "audio",
                src: voice_url,
              },
              start: 0,
              length: "auto",
            }],
          },
        ],
      },
    };

    // Add caption overlays
    if (overlay_config.captions?.enabled && on_screen_text_json.length > 0) {
      const captionTrack = {
        clips: on_screen_text_json.map((item, index) => {
          const nextItem = on_screen_text_json[index + 1];
          const duration = nextItem ? nextItem.t - item.t : 3;
          
          return {
            asset: {
              type: "text",
              text: item.text,
              font: {
                family: "Inter",
                size: overlay_config.captions.fontSize || 36,
                color: overlay_config.captions.color || "#FFFFFF",
              },
              position: overlay_config.captions.position || "center",
              animation: overlay_config.captions.animation || "none",
            },
            start: item.t,
            length: duration,
          };
        }),
      };
      
      composition.timeline.tracks.push(captionTrack);
    }

    // Add zoom effect
    if (overlay_config.zoom?.enabled) {
      composition.timeline.tracks[0].clips[0].effect = {
        type: "zoom",
        cadence: overlay_config.zoom.cadence_sec || 3,
        min: overlay_config.zoom.min || 1.0,
        max: overlay_config.zoom.max || 1.15,
      };
    }

    // Add progress bar
    if (overlay_config.progress_bar?.enabled) {
      composition.timeline.tracks.push({
        clips: [{
          asset: {
            type: "progress_bar",
            color: overlay_config.progress_bar.color || "#2EE6C9",
            position: overlay_config.progress_bar.position || "top",
            height: 4,
          },
          start: 0,
          length: "auto",
        }],
      });
    }

    return composition;
  }
}
