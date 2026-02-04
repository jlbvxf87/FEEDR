// FEEDR - Image Service Interface
// Abstraction layer for image generation (DALL-E, Midjourney, Flux, etc.)

export type ImageType = "product" | "lifestyle" | "ad" | "ugc" | "hero" | "custom";

export interface ImageOutput {
  image_url: string;
  width: number;
  height: number;
  format: "png" | "jpg" | "webp";
}

export interface ImageGenerationParams {
  prompt: string;
  clip_id: string;  // Reusing clip_id for consistency
  image_type: ImageType;
  aspect_ratio?: "1:1" | "4:5" | "9:16" | "16:9" | "3:4";
  style?: string;
  negative_prompt?: string;
}

export interface ImageService {
  /** Service identifier */
  readonly name: string;
  
  /** Supported aspect ratios */
  readonly supportedAspectRatios: string[];
  
  /** Supported image types */
  readonly supportedImageTypes: ImageType[];
  
  /**
   * Generate image from prompt
   * Returns URL to image file in storage
   */
  generateImage(params: ImageGenerationParams): Promise<ImageOutput>;
  
  /**
   * Generate multiple variations of an image
   */
  generateVariations?(params: ImageGenerationParams, count: number): Promise<ImageOutput[]>;
}

// Image style presets for different use cases
export const IMAGE_STYLE_PROMPTS: Record<ImageType, string> = {
  product: "Professional product photography, clean white background, soft studio lighting, high resolution, e-commerce ready, centered composition",
  lifestyle: "Lifestyle product photography, natural setting, warm lighting, aspirational mood, showing product in use, candid feel",
  ad: "Eye-catching advertisement style, bold colors, dynamic composition, commercial quality, scroll-stopping visuals",
  ugc: "User-generated content style, authentic feel, casual setting, smartphone quality aesthetic, relatable",
  hero: "Hero banner image, wide composition, dramatic lighting, brand-focused, premium quality",
  custom: "",
};

// Aspect ratio dimensions
export const ASPECT_RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "4:5": { width: 1024, height: 1280 },
  "9:16": { width: 1024, height: 1820 },
  "16:9": { width: 1820, height: 1024 },
  "3:4": { width: 1024, height: 1365 },
};

// Product image prompt template
export const PRODUCT_IMAGE_PROMPT_TEMPLATE = `Create a {{image_type}} image for: {{product_description}}

Style requirements:
{{style_prompt}}

Additional details:
- High quality, professional grade
- Optimized for e-commerce/social media
- {{additional_requirements}}`;
