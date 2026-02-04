// FEEDR - Mock Image Service
// Used for development and testing

import { ImageService, ImageOutput, ImageGenerationParams, ImageType, ASPECT_RATIO_DIMENSIONS } from "./interface.ts";

// Sample placeholder images for different types
const SAMPLE_IMAGES: Record<ImageType, string[]> = {
  product: [
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1024",
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1024",
    "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=1024",
  ],
  lifestyle: [
    "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1024",
    "https://images.unsplash.com/photo-1556742111-a301076d9d18?w=1024",
    "https://images.unsplash.com/photo-1556740758-90de374c12ad?w=1024",
  ],
  ad: [
    "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1024",
    "https://images.unsplash.com/photo-1607082349566-187342175e2f?w=1024",
    "https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=1024",
  ],
  ugc: [
    "https://images.unsplash.com/photo-1556742208-999815fca738?w=1024",
    "https://images.unsplash.com/photo-1556742044-3c52d6e88c62?w=1024",
    "https://images.unsplash.com/photo-1556740772-1a741367b93e?w=1024",
  ],
  hero: [
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1820",
    "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1820",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1820",
  ],
  custom: [
    "https://images.unsplash.com/photo-1557821552-17105176677c?w=1024",
  ],
};

export class MockImageService implements ImageService {
  readonly name = "mock";
  readonly supportedAspectRatios = ["1:1", "4:5", "9:16", "16:9", "3:4"];
  readonly supportedImageTypes: ImageType[] = ["product", "lifestyle", "ad", "ugc", "hero", "custom"];

  async generateImage(params: ImageGenerationParams): Promise<ImageOutput> {
    const { clip_id, image_type, aspect_ratio = "1:1" } = params;
    
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 400));
    
    // Pick a sample image based on type and clip_id hash
    const typeImages = SAMPLE_IMAGES[image_type] || SAMPLE_IMAGES.product;
    const imageIndex = clip_id.charCodeAt(0) % typeImages.length;
    
    const dimensions = ASPECT_RATIO_DIMENSIONS[aspect_ratio] || ASPECT_RATIO_DIMENSIONS["1:1"];
    
    return {
      image_url: typeImages[imageIndex],
      width: dimensions.width,
      height: dimensions.height,
      format: "jpg",
    };
  }

  async generateVariations(params: ImageGenerationParams, count: number): Promise<ImageOutput[]> {
    const results: ImageOutput[] = [];
    
    for (let i = 0; i < count; i++) {
      const output = await this.generateImage({
        ...params,
        clip_id: `${params.clip_id}-var-${i}`,
      });
      results.push(output);
    }
    
    return results;
  }
}
