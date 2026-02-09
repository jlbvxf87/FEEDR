// FEEDR - Shotstack Assembly Service
// Uses Shotstack API for professional video assembly

import { AssemblyService, AssemblyOutput, AssemblyParams, OverlayConfig } from "./interface.ts";
import { uploadVideo, downloadFile } from "../../storage.ts";
import { VIDEO_DURATION, OVERLAY_TIMING, validateOverlayTiming } from "../../timing.ts";

const SHOTSTACK_API_URL = "https://api.shotstack.io/v1"; // Use "stage" for sandbox

export class ShotstackAssemblyService implements AssemblyService {
  readonly name = "shotstack";
  
  private apiKey: string;

  constructor() {
    this.apiKey = Deno.env.get("SHOTSTACK_API_KEY") || "";
    
    if (!this.apiKey) {
      console.warn("SHOTSTACK_API_KEY not set, Shotstack service will fail");
    }
  }

  async assembleVideo(params: AssemblyParams): Promise<AssemblyOutput> {
    const { 
      clip_id, 
      raw_video_url, 
      voice_url, 
      on_screen_text_json, 
      overlay_config,
      duration_sec,
    } = params;
    
    // Use provided duration or default to Sora's max
    const videoDuration = duration_sec || VIDEO_DURATION.TARGET;
    console.log(`[Assembly] Starting assembly for clip ${clip_id}, duration: ${videoDuration}s`);

    try {
      // Build Shotstack edit JSON with explicit duration
      const edit = this.buildShotstackEdit({
        raw_video_url,
        voice_url,
        on_screen_text_json,
        overlay_config,
        video_duration: videoDuration,
      });

      console.log("Submitting to Shotstack:", JSON.stringify(edit, null, 2));

      // Submit render request
      const renderResponse = await fetch(`${SHOTSTACK_API_URL}/render`, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(edit),
      });

      if (!renderResponse.ok) {
        const error = await renderResponse.text();
        throw new Error(`Shotstack render error: ${renderResponse.status} - ${error}`);
      }

      const renderData = await renderResponse.json();
      const renderId = renderData.response.id;

      console.log(`Shotstack render started: ${renderId}`);

      // Poll for completion (Shotstack typically takes 30-120 seconds)
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes with 5s intervals
      let result: { url: string } | null = null;

      while (!result && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000)); // 5s polling
        attempts++;

        const statusResponse = await fetch(`${SHOTSTACK_API_URL}/render/${renderId}`, {
          headers: { "x-api-key": this.apiKey },
        });

        if (!statusResponse.ok) {
          console.warn(`Shotstack status check failed, attempt ${attempts}`);
          continue;
        }

        const statusData = await statusResponse.json();
        const status = statusData.response.status;

        console.log(`Shotstack status: ${status} (attempt ${attempts})`);

        if (status === "done" && statusData.response.url) {
          result = { url: statusData.response.url };
        } else if (status === "failed") {
          throw new Error(`Shotstack render failed: ${statusData.response.error || "Unknown error"}`);
        }
        // Continue polling if still rendering
      }

      if (!result) {
        throw new Error("Shotstack render timed out");
      }

      // Download rendered video and upload to our storage
      const videoData = await downloadFile(result.url);
      const final_url = await uploadVideo("final", clip_id, videoData);
      
      console.log(`[Assembly] Complete! Final video: ${videoDuration}s`);

      return {
        final_url,
        duration_seconds: videoDuration,
      };

    } catch (error) {
      console.error("Shotstack assembly failed:", error);
      throw error;
    }
  }

  private buildShotstackEdit(params: {
    raw_video_url: string;
    voice_url: string;
    on_screen_text_json: Array<{ t: number; text: string }>;
    overlay_config: OverlayConfig;
    video_duration?: number;
  }) {
    const { raw_video_url, voice_url, on_screen_text_json, overlay_config } = params;
    
    // Use exact video duration - Sora produces fixed 15 or 10 second videos
    const videoDuration = params.video_duration || VIDEO_DURATION.TARGET;
    console.log(`[Assembly] Building edit for ${videoDuration}s video`);

    const tracks: any[] = [];

    // Track 1: Text overlays (on top) - validated to fit within video duration
    if (overlay_config.captions?.enabled && on_screen_text_json.length > 0) {
      // Validate and adjust overlay timing to fit within video
      const validatedOverlays = validateOverlayTiming(on_screen_text_json, videoDuration);
      
      const textClips = validatedOverlays.map((item) => {
        // Ensure overlay doesn't extend past video end
        const maxLength = Math.min(item.duration, videoDuration - item.t - 0.5);
        
        return {
          asset: {
            type: "text",
            text: item.text,
            style: "blockbuster",
            size: "medium",
            position: "center",
            offset: {
              y: 0.35, // Position text in lower third
            },
          },
          start: item.t,
          length: Math.max(maxLength, OVERLAY_TIMING.MIN_DISPLAY_TIME),
          transition: {
            in: "fade",
            out: "fade",
          },
        };
      });

      if (textClips.length > 0) {
        tracks.push({ clips: textClips });
      }
    }

    // Track 2: Main video - use explicit duration to match Sora output
    // Mute raw video (volume: 0) to avoid voice overlap with voiceover soundtrack
    tracks.push({
      clips: [{
        asset: {
          type: "video",
          src: raw_video_url,
          volume: 0,
        },
        start: 0,
        length: videoDuration, // Explicit duration, not "auto"
      }],
    });

    // Build the edit object
    const edit: any = {
      timeline: {
        background: "#000000",
        tracks,
      },
      output: {
        format: "mp4",
        resolution: "hd", // 1080p
        aspectRatio: "9:16", // Vertical video
        fps: 30,
      },
    };

    // Add voiceover as soundtrack with explicit trim to video duration
    if (voice_url) {
      edit.timeline.soundtrack = {
        src: voice_url,
        effect: "fadeOut",
        // Trim audio to match video duration if needed
        // Shotstack will cut audio at video end automatically
      };
    }
    
    console.log(`[Assembly] Edit configured: ${videoDuration}s video, ${tracks[0]?.clips?.length || 0} overlays`);

    return edit;
  }
}
