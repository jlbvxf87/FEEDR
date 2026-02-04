// FEEDR - Social Media Platform Specifications
// Comprehensive sizing, resolution, and format specs for all major platforms
// Users pick a PLATFORM, we handle the technical details

// =============================================================================
// PLATFORM TYPES
// =============================================================================

export type VideoPlatform = 
  | "tiktok"
  | "instagram_reels" 
  | "instagram_story"
  | "instagram_feed"
  | "youtube_shorts"
  | "youtube_standard"
  | "facebook_reels"
  | "facebook_feed"
  | "twitter"
  | "linkedin"
  | "pinterest"
  | "snapchat";

export type ImagePlatform =
  | "instagram_feed"
  | "instagram_story"
  | "instagram_carousel"
  | "tiktok_cover"
  | "facebook_feed"
  | "facebook_ad"
  | "twitter"
  | "linkedin"
  | "pinterest"
  | "youtube_thumbnail"
  | "ecommerce";

export type ContentType = "video" | "image";

// =============================================================================
// PLATFORM SPECIFICATIONS
// =============================================================================

export interface PlatformSpec {
  name: string;
  platform: string;
  description: string;
  
  // Dimensions
  aspectRatio: string;
  width: number;
  height: number;
  
  // Quality
  minWidth?: number;
  maxWidth?: number;
  recommendedWidth: number;
  recommendedHeight: number;
  
  // Video-specific
  maxDuration?: number;      // seconds
  minDuration?: number;      // seconds
  recommendedDuration?: number;
  maxFileSize?: number;      // MB
  frameRate?: number;        // fps
  
  // Format
  formats: string[];         // ['mp4', 'mov'] or ['jpg', 'png', 'webp']
  codec?: string;            // 'h264', 'h265'
  
  // Platform tips
  tips: string[];
}

// =============================================================================
// VIDEO PLATFORM SPECS
// =============================================================================

export const VIDEO_PLATFORM_SPECS: Record<VideoPlatform, PlatformSpec> = {
  tiktok: {
    name: "TikTok",
    platform: "tiktok",
    description: "Vertical video for TikTok feed",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    minWidth: 540,
    maxWidth: 1080,
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    maxDuration: 180,        // 3 minutes max
    minDuration: 3,
    recommendedDuration: 15, // Sweet spot for engagement
    maxFileSize: 287,        // MB
    frameRate: 30,
    formats: ["mp4", "mov"],
    codec: "h264",
    tips: [
      "First 1-3 seconds are critical for retention",
      "Use trending sounds for discovery",
      "Captions boost watch time by 40%",
      "Vertical video gets 25% more engagement"
    ]
  },
  
  instagram_reels: {
    name: "Instagram Reels",
    platform: "instagram",
    description: "Vertical video for Reels tab",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    minWidth: 500,
    maxWidth: 1080,
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    maxDuration: 90,
    minDuration: 3,
    recommendedDuration: 15,
    maxFileSize: 250,
    frameRate: 30,
    formats: ["mp4", "mov"],
    codec: "h264",
    tips: [
      "Reels get 22% more engagement than regular videos",
      "Hook viewers in first 1.7 seconds",
      "Use 3-5 hashtags for optimal reach",
      "Post during peak hours (11am-1pm, 7pm-9pm)"
    ]
  },
  
  instagram_story: {
    name: "Instagram Story",
    platform: "instagram",
    description: "Full-screen vertical story format",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    minWidth: 500,
    maxWidth: 1080,
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    maxDuration: 60,
    minDuration: 1,
    recommendedDuration: 15,
    maxFileSize: 250,
    frameRate: 30,
    formats: ["mp4", "mov"],
    codec: "h264",
    tips: [
      "Stories disappear in 24 hours - create urgency",
      "Use polls and questions for engagement",
      "Keep text in safe zone (avoid top/bottom 250px)",
      "First story in sequence gets most views"
    ]
  },
  
  instagram_feed: {
    name: "Instagram Feed Video",
    platform: "instagram",
    description: "Square or portrait video for feed",
    aspectRatio: "4:5",
    width: 1080,
    height: 1350,
    minWidth: 500,
    maxWidth: 1080,
    recommendedWidth: 1080,
    recommendedHeight: 1350,
    maxDuration: 60,
    minDuration: 3,
    recommendedDuration: 30,
    maxFileSize: 250,
    frameRate: 30,
    formats: ["mp4", "mov"],
    codec: "h264",
    tips: [
      "4:5 takes up more screen real estate than 1:1",
      "First frame is your thumbnail - make it count",
      "Add captions - 85% watch without sound",
      "Carousel posts get 3x more engagement"
    ]
  },
  
  youtube_shorts: {
    name: "YouTube Shorts",
    platform: "youtube",
    description: "Vertical short-form video",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    minWidth: 540,
    maxWidth: 1080,
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    maxDuration: 60,
    minDuration: 15,
    recommendedDuration: 30,
    maxFileSize: 256,
    frameRate: 30,
    formats: ["mp4", "mov", "webm"],
    codec: "h264",
    tips: [
      "Shorts can drive subscribers to long-form content",
      "Include #Shorts in title or description",
      "Loop-friendly content performs better",
      "Strong hook in first 2 seconds"
    ]
  },
  
  youtube_standard: {
    name: "YouTube Video",
    platform: "youtube",
    description: "Standard horizontal video",
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    minWidth: 1280,
    maxWidth: 3840,
    recommendedWidth: 1920,
    recommendedHeight: 1080,
    maxDuration: 43200, // 12 hours
    minDuration: 1,
    recommendedDuration: 480, // 8 minutes for ad revenue
    maxFileSize: 256000, // 256GB
    frameRate: 30,
    formats: ["mp4", "mov", "avi", "webm"],
    codec: "h264",
    tips: [
      "First 30 seconds determine 70% of watch time",
      "Thumbnail is 90% of click-through rate",
      "8-12 minutes optimal for monetization",
      "End screens in last 20 seconds"
    ]
  },
  
  facebook_reels: {
    name: "Facebook Reels",
    platform: "facebook",
    description: "Vertical video for Reels",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    minWidth: 540,
    maxWidth: 1080,
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    maxDuration: 90,
    minDuration: 3,
    recommendedDuration: 15,
    maxFileSize: 250,
    frameRate: 30,
    formats: ["mp4", "mov"],
    codec: "h264",
    tips: [
      "Cross-post from Instagram Reels",
      "Facebook audience skews older - adjust content",
      "Use original audio for better reach",
      "Strong text overlays help with sound-off viewing"
    ]
  },
  
  facebook_feed: {
    name: "Facebook Feed Video",
    platform: "facebook",
    description: "Video for Facebook news feed",
    aspectRatio: "1:1",
    width: 1080,
    height: 1080,
    minWidth: 600,
    maxWidth: 1080,
    recommendedWidth: 1080,
    recommendedHeight: 1080,
    maxDuration: 240,
    minDuration: 1,
    recommendedDuration: 60,
    maxFileSize: 4000,
    frameRate: 30,
    formats: ["mp4", "mov"],
    codec: "h264",
    tips: [
      "Square videos get 35% more views than landscape",
      "Captions are essential - 85% watch muted",
      "Native uploads get 10x more reach than links",
      "First 3 seconds must hook"
    ]
  },
  
  twitter: {
    name: "Twitter/X Video",
    platform: "twitter",
    description: "Video for Twitter timeline",
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    minWidth: 640,
    maxWidth: 1920,
    recommendedWidth: 1280,
    recommendedHeight: 720,
    maxDuration: 140,
    minDuration: 0.5,
    recommendedDuration: 45,
    maxFileSize: 512,
    frameRate: 30,
    formats: ["mp4", "mov"],
    codec: "h264",
    tips: [
      "Videos get 10x more engagement than static tweets",
      "Keep under 45 seconds for optimal completion",
      "Add captions - most watch without sound",
      "Tweet during peak hours (9am-12pm weekdays)"
    ]
  },
  
  linkedin: {
    name: "LinkedIn Video",
    platform: "linkedin",
    description: "Professional video for LinkedIn",
    aspectRatio: "1:1",
    width: 1080,
    height: 1080,
    minWidth: 256,
    maxWidth: 4096,
    recommendedWidth: 1080,
    recommendedHeight: 1080,
    maxDuration: 600,
    minDuration: 3,
    recommendedDuration: 90,
    maxFileSize: 5000,
    frameRate: 30,
    formats: ["mp4", "mov"],
    codec: "h264",
    tips: [
      "B2B content performs well",
      "Educational content gets most engagement",
      "Post Tuesday-Thursday for best reach",
      "Native video gets 5x more reach"
    ]
  },
  
  pinterest: {
    name: "Pinterest Video",
    platform: "pinterest",
    description: "Vertical video pin",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    minWidth: 240,
    maxWidth: 1080,
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    maxDuration: 900, // 15 minutes
    minDuration: 4,
    recommendedDuration: 15,
    maxFileSize: 2000,
    frameRate: 25,
    formats: ["mp4", "mov"],
    codec: "h264",
    tips: [
      "Tutorial content performs best",
      "Add text overlay - Pinterest is visual search",
      "Longer videos (15-60s) get more saves",
      "Include clear call-to-action"
    ]
  },
  
  snapchat: {
    name: "Snapchat Video",
    platform: "snapchat",
    description: "Full-screen vertical Snap",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    minWidth: 540,
    maxWidth: 1080,
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    maxDuration: 60,
    minDuration: 1,
    recommendedDuration: 10,
    maxFileSize: 256,
    frameRate: 30,
    formats: ["mp4", "mov"],
    codec: "h264",
    tips: [
      "Keep it casual and authentic",
      "Quick cuts maintain attention",
      "Use AR filters for engagement",
      "Story format - create multi-snap narratives"
    ]
  }
};

// =============================================================================
// IMAGE PLATFORM SPECS
// =============================================================================

export const IMAGE_PLATFORM_SPECS: Record<ImagePlatform, PlatformSpec> = {
  instagram_feed: {
    name: "Instagram Feed",
    platform: "instagram",
    description: "Square or portrait image for feed",
    aspectRatio: "4:5",
    width: 1080,
    height: 1350,
    minWidth: 320,
    maxWidth: 1080,
    recommendedWidth: 1080,
    recommendedHeight: 1350,
    formats: ["jpg", "png"],
    tips: [
      "4:5 takes up maximum screen space",
      "Consistent aesthetic builds brand",
      "High contrast images perform better",
      "Faces get 38% more likes"
    ]
  },
  
  instagram_story: {
    name: "Instagram Story",
    platform: "instagram",
    description: "Full-screen vertical story",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    minWidth: 600,
    maxWidth: 1080,
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    formats: ["jpg", "png"],
    tips: [
      "Keep text in safe zone (top/bottom 250px)",
      "Use stickers and polls for engagement",
      "Bright colors stand out",
      "Single focus point works best"
    ]
  },
  
  instagram_carousel: {
    name: "Instagram Carousel",
    platform: "instagram",
    description: "Multi-image carousel post",
    aspectRatio: "1:1",
    width: 1080,
    height: 1080,
    minWidth: 320,
    maxWidth: 1080,
    recommendedWidth: 1080,
    recommendedHeight: 1080,
    formats: ["jpg", "png"],
    tips: [
      "First slide is your hook",
      "Carousels get 3x engagement",
      "Tell a story across slides",
      "CTA on last slide"
    ]
  },
  
  tiktok_cover: {
    name: "TikTok Cover",
    platform: "tiktok",
    description: "Video cover image",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    minWidth: 540,
    maxWidth: 1080,
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    formats: ["jpg", "png"],
    tips: [
      "Text overlay improves clicks",
      "Faces with expressions work well",
      "Consistent style builds recognition",
      "Avoid text in bottom 200px (UI overlay)"
    ]
  },
  
  facebook_feed: {
    name: "Facebook Feed",
    platform: "facebook",
    description: "Image for news feed",
    aspectRatio: "1:1",
    width: 1080,
    height: 1080,
    minWidth: 600,
    maxWidth: 2048,
    recommendedWidth: 1200,
    recommendedHeight: 1200,
    formats: ["jpg", "png"],
    tips: [
      "Square images take up more feed space",
      "Native posts outperform link previews",
      "Use high contrast for mobile",
      "Less than 20% text for ads"
    ]
  },
  
  facebook_ad: {
    name: "Facebook Ad",
    platform: "facebook",
    description: "Ad creative for Facebook/Meta",
    aspectRatio: "1:1",
    width: 1080,
    height: 1080,
    minWidth: 600,
    maxWidth: 1080,
    recommendedWidth: 1080,
    recommendedHeight: 1080,
    formats: ["jpg", "png"],
    tips: [
      "Clear product/offer visible",
      "Less than 20% text recommended",
      "High contrast for thumb-stopping",
      "Test multiple creatives"
    ]
  },
  
  twitter: {
    name: "Twitter/X Image",
    platform: "twitter",
    description: "Image for tweets",
    aspectRatio: "16:9",
    width: 1200,
    height: 675,
    minWidth: 600,
    maxWidth: 4096,
    recommendedWidth: 1200,
    recommendedHeight: 675,
    formats: ["jpg", "png", "gif", "webp"],
    tips: [
      "16:9 displays best in timeline",
      "Text overlays help with context",
      "Images get 150% more retweets",
      "GIFs get even more engagement"
    ]
  },
  
  linkedin: {
    name: "LinkedIn Image",
    platform: "linkedin",
    description: "Professional image post",
    aspectRatio: "1.91:1",
    width: 1200,
    height: 628,
    minWidth: 552,
    maxWidth: 2048,
    recommendedWidth: 1200,
    recommendedHeight: 628,
    formats: ["jpg", "png"],
    tips: [
      "Professional, clean aesthetic",
      "Infographics perform well",
      "Faces increase engagement",
      "Data visualizations get shared"
    ]
  },
  
  pinterest: {
    name: "Pinterest Pin",
    platform: "pinterest",
    description: "Vertical pin image",
    aspectRatio: "2:3",
    width: 1000,
    height: 1500,
    minWidth: 600,
    maxWidth: 2000,
    recommendedWidth: 1000,
    recommendedHeight: 1500,
    formats: ["jpg", "png"],
    tips: [
      "Vertical images get more saves",
      "Text overlay helps discoverability",
      "Bright, colorful images perform best",
      "Product images with context"
    ]
  },
  
  youtube_thumbnail: {
    name: "YouTube Thumbnail",
    platform: "youtube",
    description: "Video thumbnail image",
    aspectRatio: "16:9",
    width: 1280,
    height: 720,
    minWidth: 1280,
    maxWidth: 1280,
    recommendedWidth: 1280,
    recommendedHeight: 720,
    formats: ["jpg", "png"],
    tips: [
      "Thumbnail is 90% of click-through",
      "Faces with expressions work best",
      "High contrast, readable text",
      "Consistent style across channel"
    ]
  },
  
  ecommerce: {
    name: "E-commerce/Product",
    platform: "ecommerce",
    description: "Product listing image",
    aspectRatio: "1:1",
    width: 2000,
    height: 2000,
    minWidth: 1000,
    maxWidth: 4000,
    recommendedWidth: 2000,
    recommendedHeight: 2000,
    formats: ["jpg", "png", "webp"],
    tips: [
      "White background for marketplaces",
      "Multiple angles (front, back, detail)",
      "Zoom-friendly resolution",
      "Consistent lighting across products"
    ]
  }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the best platform spec for a given aspect ratio
 */
export function getSpecForAspectRatio(
  aspectRatio: string, 
  contentType: ContentType
): PlatformSpec | null {
  const specs = contentType === "video" ? VIDEO_PLATFORM_SPECS : IMAGE_PLATFORM_SPECS;
  
  for (const spec of Object.values(specs)) {
    if (spec.aspectRatio === aspectRatio) {
      return spec;
    }
  }
  return null;
}

/**
 * Get recommended platforms for video content
 */
export function getVideoRecommendations(duration: number): VideoPlatform[] {
  const recommendations: VideoPlatform[] = [];
  
  if (duration <= 60) {
    recommendations.push("tiktok", "instagram_reels", "youtube_shorts");
  }
  if (duration <= 90) {
    recommendations.push("facebook_reels");
  }
  if (duration > 60) {
    recommendations.push("youtube_standard", "facebook_feed");
  }
  
  return recommendations;
}

/**
 * Get dimensions object from platform spec
 */
export function getDimensions(platform: VideoPlatform | ImagePlatform, contentType: ContentType): { width: number; height: number; aspectRatio: string } {
  const spec = contentType === "video" 
    ? VIDEO_PLATFORM_SPECS[platform as VideoPlatform]
    : IMAGE_PLATFORM_SPECS[platform as ImagePlatform];
  
  return {
    width: spec.recommendedWidth,
    height: spec.recommendedHeight,
    aspectRatio: spec.aspectRatio
  };
}

/**
 * Quick lookup for common social media formats
 */
export const QUICK_FORMATS = {
  // Vertical (9:16) - TikTok, Reels, Shorts, Stories
  vertical: {
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    platforms: ["TikTok", "Instagram Reels", "YouTube Shorts", "Stories", "Snapchat"]
  },
  // Square (1:1) - Feed posts, Facebook
  square: {
    aspectRatio: "1:1",
    width: 1080,
    height: 1080,
    platforms: ["Instagram Feed", "Facebook", "LinkedIn", "Carousel"]
  },
  // Portrait (4:5) - Instagram Feed optimal
  portrait: {
    aspectRatio: "4:5",
    width: 1080,
    height: 1350,
    platforms: ["Instagram Feed (optimal)", "Facebook"]
  },
  // Landscape (16:9) - YouTube, Twitter
  landscape: {
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    platforms: ["YouTube", "Twitter", "LinkedIn", "Thumbnails"]
  },
  // Pinterest (2:3) - Pinterest pins
  pinterest: {
    aspectRatio: "2:3",
    width: 1000,
    height: 1500,
    platforms: ["Pinterest"]
  }
} as const;

/**
 * Default specs based on content type
 */
export const DEFAULT_SPECS = {
  video: VIDEO_PLATFORM_SPECS.tiktok,    // Vertical video is most versatile
  image: IMAGE_PLATFORM_SPECS.instagram_feed  // 4:5 is most versatile
};
