// FEEDR - DALL-E Image Service
// Uses OpenAI DALL-E 3 for image generation

import { 
  ImageService, 
  ImageOutput, 
  ImageGenerationParams, 
  ImageType,
  IMAGE_STYLE_PROMPTS,
  ASPECT_RATIO_DIMENSIONS 
} from "./interface.ts";
import { uploadToStorage } from "../../storage.ts";

const OPENAI_API_URL = "https://api.openai.com/v1/images/generations";

export class DalleImageService implements ImageService {
  readonly name = "dalle";
  readonly supportedAspectRatios = ["1:1", "16:9", "9:16"]; // DALL-E 3 supported sizes
  readonly supportedImageTypes: ImageType[] = ["product", "lifestyle", "ad", "ugc", "hero", "custom"];
  
  private apiKey: string;

  constructor() {
    this.apiKey = Deno.env.get("OPENAI_API_KEY") || "";
    
    if (!this.apiKey) {
      console.warn("OPENAI_API_KEY not set, DALL-E service will fail");
    }
  }

  async generateImage(params: ImageGenerationParams): Promise<ImageOutput> {
    const { prompt, clip_id, image_type, aspect_ratio = "1:1", style, negative_prompt } = params;
    
    // Build enhanced prompt with style
    const stylePrompt = style || IMAGE_STYLE_PROMPTS[image_type];
    const fullPrompt = `${prompt}\n\nStyle: ${stylePrompt}${negative_prompt ? `\n\nAvoid: ${negative_prompt}` : ""}`;
    
    // Map aspect ratio to DALL-E size
    const sizeMap: Record<string, string> = {
      "1:1": "1024x1024",
      "16:9": "1792x1024",
      "9:16": "1024x1792",
    };
    const size = sizeMap[aspect_ratio] || "1024x1024";
    
    try {
      const response = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: fullPrompt,
          n: 1,
          size,
          quality: "hd",
          response_format: "url",
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`DALL-E API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const imageUrl = data.data[0]?.url;
      
      if (!imageUrl) {
        throw new Error("No image URL in DALL-E response");
      }

      // Download and upload to our storage
      const imageResponse = await fetch(imageUrl);
      const imageData = await imageResponse.arrayBuffer();
      
      const storagePath = `images/${clip_id}.png`;
      const result = await uploadToStorage("final", storagePath, imageData, "image/png");
      
      const dimensions = ASPECT_RATIO_DIMENSIONS[aspect_ratio] || { width: 1024, height: 1024 };

      return {
        image_url: result.publicUrl,
        width: dimensions.width,
        height: dimensions.height,
        format: "png",
      };
      
    } catch (error) {
      console.error("DALL-E image generation failed:", error);
      throw error;
    }
  }

  async generateVariations(params: ImageGenerationParams, count: number): Promise<ImageOutput[]> {
    // DALL-E 3 doesn't support n > 1, so we make multiple requests
    const results: ImageOutput[] = [];
    
    for (let i = 0; i < count; i++) {
      // Add variation to prompt for diversity
      const variedParams = {
        ...params,
        prompt: `${params.prompt} (variation ${i + 1}, unique angle/composition)`,
        clip_id: `${params.clip_id}-var-${i}`,
      };
      
      const output = await this.generateImage(variedParams);
      results.push(output);
      
      // Small delay between requests
      await new Promise(r => setTimeout(r, 500));
    }
    
    return results;
  }
}
