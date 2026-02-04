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

// =============================================================================
// ASPECT RATIO DIMENSIONS - Optimized for social media platforms
// All dimensions are HD-ready and platform-compliant
// =============================================================================

export const ASPECT_RATIO_DIMENSIONS: Record<string, { 
  width: number; 
  height: number;
  platforms: string[];
  description: string;
}> = {
  // Square - Instagram Feed, Facebook, LinkedIn, Carousel posts
  "1:1": { 
    width: 1080, 
    height: 1080,
    platforms: ["Instagram Feed", "Facebook", "LinkedIn", "Carousel"],
    description: "Square - Universal feed format"
  },
  
  // Portrait - Instagram Feed optimal (takes up more screen)
  "4:5": { 
    width: 1080, 
    height: 1350,
    platforms: ["Instagram Feed (optimal)", "Facebook"],
    description: "Portrait - Max Instagram feed space"
  },
  
  // Vertical - TikTok, Reels, Shorts, Stories
  "9:16": { 
    width: 1080, 
    height: 1920,
    platforms: ["TikTok", "Instagram Reels", "YouTube Shorts", "Stories", "Snapchat"],
    description: "Vertical - Full-screen mobile"
  },
  
  // Landscape - YouTube, Twitter, LinkedIn articles
  "16:9": { 
    width: 1920, 
    height: 1080,
    platforms: ["YouTube", "Twitter", "LinkedIn", "Thumbnails"],
    description: "Landscape - Widescreen HD"
  },
  
  // Pinterest - Vertical pins
  "2:3": { 
    width: 1000, 
    height: 1500,
    platforms: ["Pinterest"],
    description: "Pinterest - Vertical pin format"
  },
  
  // Legacy 3:4 - Keep for backwards compatibility
  "3:4": { 
    width: 1080, 
    height: 1440,
    platforms: ["General portrait"],
    description: "Portrait - 3:4 ratio"
  },
};

// Quality tiers for different use cases
export const QUALITY_TIERS = {
  standard: {
    multiplier: 1.0,
    description: "Standard quality (1080p)",
    use_cases: ["Social media", "Web"]
  },
  high: {
    multiplier: 1.5,
    description: "High quality (1620p)", 
    use_cases: ["Print-ready", "Zoom-safe"]
  },
  ultra: {
    multiplier: 2.0,
    description: "Ultra quality (2160p/4K)",
    use_cases: ["Large format", "E-commerce zoom"]
  }
} as const;

/**
 * Get dimensions for aspect ratio with optional quality multiplier
 */
export function getImageDimensions(
  aspectRatio: string, 
  quality: keyof typeof QUALITY_TIERS = "standard"
): { width: number; height: number } {
  const base = ASPECT_RATIO_DIMENSIONS[aspectRatio] || ASPECT_RATIO_DIMENSIONS["1:1"];
  const multiplier = QUALITY_TIERS[quality].multiplier;
  
  return {
    width: Math.round(base.width * multiplier),
    height: Math.round(base.height * multiplier)
  };
}

// Product image prompt template
export const PRODUCT_IMAGE_PROMPT_TEMPLATE = `Create a {{image_type}} image for: {{product_description}}

Style requirements:
{{style_prompt}}

Additional details:
- High quality, professional grade
- Optimized for e-commerce/social media
- {{additional_requirements}}`;
