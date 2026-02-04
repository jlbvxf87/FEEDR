// FEEDR - Flux Image Service
// Uses Flux (via Replicate or BFL API) for image generation

import { 
  ImageService, 
  ImageOutput, 
  ImageGenerationParams, 
  ImageType,
  IMAGE_STYLE_PROMPTS,
  ASPECT_RATIO_DIMENSIONS 
} from "./interface.ts";
import { uploadToStorage } from "../../storage.ts";

// Using Replicate API for Flux
const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";

export class FluxImageService implements ImageService {
  readonly name = "flux";
  readonly supportedAspectRatios = ["1:1", "4:5", "9:16", "16:9", "3:4"];
  readonly supportedImageTypes: ImageType[] = ["product", "lifestyle", "ad", "ugc", "hero", "custom"];
  
  private apiKey: string;
  private modelVersion: string;

  constructor() {
    this.apiKey = Deno.env.get("REPLICATE_API_KEY") || "";
    // Flux 1.1 Pro model version
    this.modelVersion = Deno.env.get("FLUX_MODEL_VERSION") || "black-forest-labs/flux-1.1-pro";
    
    if (!this.apiKey) {
      console.warn("REPLICATE_API_KEY not set, Flux service will fail");
    }
  }

  async generateImage(params: ImageGenerationParams): Promise<ImageOutput> {
    const { prompt, clip_id, image_type, aspect_ratio = "1:1", style, negative_prompt } = params;
    
    // Build enhanced prompt with style
    const stylePrompt = style || IMAGE_STYLE_PROMPTS[image_type];
    const fullPrompt = `${prompt}. ${stylePrompt}`;
    
    const dimensions = ASPECT_RATIO_DIMENSIONS[aspect_ratio] || ASPECT_RATIO_DIMENSIONS["1:1"];
    
    try {
      // Create prediction
      const createResponse = await fetch(REPLICATE_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.modelVersion,
          input: {
            prompt: fullPrompt,
            width: dimensions.width,
            height: dimensions.height,
            num_outputs: 1,
            guidance_scale: 3.5,
            num_inference_steps: 28,
            output_format: "webp",
            output_quality: 90,
          },
        }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.text();
        throw new Error(`Flux API error: ${createResponse.status} - ${error}`);
      }

      const prediction = await createResponse.json();
      
      // Poll for completion
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes
      let result: string | null = null;
      
      while (!result && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000));
        attempts++;
        
        const statusResponse = await fetch(
          `${REPLICATE_API_URL}/${prediction.id}`,
          { headers: { "Authorization": `Bearer ${this.apiKey}` } }
        );

        if (!statusResponse.ok) continue;

        const status = await statusResponse.json();

        if (status.status === "succeeded" && status.output?.[0]) {
          result = status.output[0];
        } else if (status.status === "failed") {
          throw new Error(`Flux generation failed: ${status.error}`);
        }
      }

      if (!result) {
        throw new Error("Flux generation timed out");
      }

      // Download and upload to our storage
      const imageResponse = await fetch(result);
      const imageData = await imageResponse.arrayBuffer();
      
      const storagePath = `images/${clip_id}.webp`;
      const uploadResult = await uploadToStorage("final", storagePath, imageData, "image/webp");

      return {
        image_url: uploadResult.publicUrl,
        width: dimensions.width,
        height: dimensions.height,
        format: "webp",
      };
      
    } catch (error) {
      console.error("Flux image generation failed:", error);
      throw error;
    }
  }

  async generateVariations(params: ImageGenerationParams, count: number): Promise<ImageOutput[]> {
    const results: ImageOutput[] = [];
    
    for (let i = 0; i < count; i++) {
      const variedParams = {
        ...params,
        prompt: `${params.prompt} (variation ${i + 1}, different angle)`,
        clip_id: `${params.clip_id}-var-${i}`,
      };
      
      const output = await this.generateImage(variedParams);
      results.push(output);
      
      await new Promise(r => setTimeout(r, 500));
    }
    
    return results;
  }
}
