// FEEDR - Shotstack Assembly Service
// Uses Shotstack API for professional video assembly

import { AssemblyService, AssemblyOutput, AssemblyParams, OverlayConfig } from "./interface.ts";
import { uploadVideo, downloadFile } from "../../storage.ts";

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
      overlay_config 
    } = params;

    try {
      // Build Shotstack edit JSON
      const edit = this.buildShotstackEdit({
        raw_video_url,
        voice_url,
        on_screen_text_json,
        overlay_config,
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

      return {
        final_url,
        duration_seconds: 15, // Could extract from Shotstack response
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
  }) {
    const { raw_video_url, voice_url, on_screen_text_json, overlay_config } = params;

    const tracks: any[] = [];

    // Track 1: Text overlays (on top)
    if (overlay_config.captions?.enabled && on_screen_text_json.length > 0) {
      const textClips = on_screen_text_json.map((item, index) => {
        const nextItem = on_screen_text_json[index + 1];
        const duration = nextItem ? nextItem.t - item.t : 3;
        
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
          length: Math.max(duration, 0.5),
          transition: {
            in: "fade",
            out: "fade",
          },
        };
      });

      tracks.push({ clips: textClips });
    }

    // Track 2: Main video
    tracks.push({
      clips: [{
        asset: {
          type: "video",
          src: raw_video_url,
          volume: 0.1, // Lower original video volume
        },
        start: 0,
        length: "auto",
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

    // Add voiceover as soundtrack
    if (voice_url) {
      edit.timeline.soundtrack = {
        src: voice_url,
        effect: "fadeOut",
      };
    }

    return edit;
  }
}
