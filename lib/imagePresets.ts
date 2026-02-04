// FEEDR - Smart Image Presets
// Pre-configured packs that generate multiple image types automatically

export type ImagePack = "auto" | "product" | "lifestyle" | "ads" | "social";

export interface ImagePackConfig {
  name: string;
  description: string;
  icon: string;
  variations: Array<{
    type: string;
    promptSuffix: string;
    aspectRatio: string;
  }>;
}

export const IMAGE_PACKS: Record<ImagePack, ImagePackConfig> = {
  auto: {
    name: "Auto Mix",
    description: "Best variety - product, lifestyle & ad shots",
    icon: "✨",
    variations: [
      // Product shots
      { type: "product_white", promptSuffix: "professional product photography, pure white background, soft studio lighting, e-commerce ready, high resolution, centered", aspectRatio: "1:1" },
      { type: "product_gradient", promptSuffix: "professional product photo, subtle gradient background, premium feel, studio lighting", aspectRatio: "1:1" },
      { type: "product_shadow", promptSuffix: "product photography, white background with soft shadow, clean minimal aesthetic", aspectRatio: "1:1" },
      // Lifestyle shots
      { type: "lifestyle_use", promptSuffix: "lifestyle photography, product in use, natural setting, warm lighting, aspirational", aspectRatio: "4:5" },
      { type: "lifestyle_flat", promptSuffix: "flat lay photography, product with complementary items, top-down view, styled composition", aspectRatio: "1:1" },
      { type: "lifestyle_hands", promptSuffix: "hands holding product, natural lighting, authentic feel, lifestyle context", aspectRatio: "4:5" },
      // Ad creatives
      { type: "ad_bold", promptSuffix: "bold advertisement style, vibrant colors, dynamic composition, eye-catching", aspectRatio: "9:16" },
      { type: "ad_minimal", promptSuffix: "minimal advertisement, clean design, lots of white space, elegant", aspectRatio: "1:1" },
      { type: "ad_ugc", promptSuffix: "user-generated content style, authentic, casual setting, relatable", aspectRatio: "9:16" },
    ],
  },
  product: {
    name: "Product Pack",
    description: "9 clean product shots for listings",
    icon: "📦",
    variations: [
      { type: "front", promptSuffix: "product front view, white background, studio lighting, e-commerce", aspectRatio: "1:1" },
      { type: "angle", promptSuffix: "product 3/4 angle view, white background, showing depth", aspectRatio: "1:1" },
      { type: "detail", promptSuffix: "product detail close-up, macro photography, showing texture and quality", aspectRatio: "1:1" },
      { type: "top", promptSuffix: "product top-down view, white background, flat lay style", aspectRatio: "1:1" },
      { type: "side", promptSuffix: "product side profile, white background, clean silhouette", aspectRatio: "1:1" },
      { type: "gradient", promptSuffix: "product on gradient background, premium feel, subtle shadow", aspectRatio: "1:1" },
      { type: "floating", promptSuffix: "product floating with soft shadow, clean white background", aspectRatio: "1:1" },
      { type: "group", promptSuffix: "product with accessories or variants, styled grouping", aspectRatio: "16:9" },
      { type: "hero", promptSuffix: "hero product shot, dramatic lighting, premium quality", aspectRatio: "16:9" },
    ],
  },
  lifestyle: {
    name: "Lifestyle Pack",
    description: "9 contextual lifestyle scenes",
    icon: "🌟",
    variations: [
      { type: "home", promptSuffix: "product in modern home setting, natural daylight, cozy atmosphere", aspectRatio: "4:5" },
      { type: "outdoor", promptSuffix: "product outdoors, natural environment, golden hour lighting", aspectRatio: "4:5" },
      { type: "work", promptSuffix: "product in workspace/office setting, professional environment", aspectRatio: "4:5" },
      { type: "gym", promptSuffix: "product in gym/fitness setting, active lifestyle", aspectRatio: "4:5" },
      { type: "travel", promptSuffix: "product in travel context, adventure setting", aspectRatio: "4:5" },
      { type: "morning", promptSuffix: "product in morning routine context, soft morning light", aspectRatio: "4:5" },
      { type: "hands", promptSuffix: "hands using product, authentic moment, natural lighting", aspectRatio: "4:5" },
      { type: "table", promptSuffix: "product on styled table, lifestyle flat lay, curated items", aspectRatio: "1:1" },
      { type: "action", promptSuffix: "product in action/use, dynamic moment, lifestyle photography", aspectRatio: "9:16" },
    ],
  },
  ads: {
    name: "Ad Creatives",
    description: "9 scroll-stopping ad images",
    icon: "🎯",
    variations: [
      { type: "bold_vertical", promptSuffix: "bold advertisement, vibrant colors, product prominent, vertical format", aspectRatio: "9:16" },
      { type: "bold_square", promptSuffix: "bold advertisement, eye-catching colors, centered product", aspectRatio: "1:1" },
      { type: "minimal_clean", promptSuffix: "minimal advertisement, white space, elegant product placement", aspectRatio: "1:1" },
      { type: "minimal_text", promptSuffix: "minimal design with space for text overlay, clean aesthetic", aspectRatio: "9:16" },
      { type: "ugc_authentic", promptSuffix: "user-generated content style ad, authentic feel, casual", aspectRatio: "9:16" },
      { type: "ugc_review", promptSuffix: "testimonial style, product with 5-star feeling, trustworthy", aspectRatio: "1:1" },
      { type: "sale_urgent", promptSuffix: "sale/promo style, urgent feel, bold colors, exciting", aspectRatio: "1:1" },
      { type: "premium", promptSuffix: "premium brand advertisement, luxury feel, sophisticated", aspectRatio: "4:5" },
      { type: "comparison", promptSuffix: "before/after or comparison style, clear benefit shown", aspectRatio: "1:1" },
    ],
  },
  social: {
    name: "Social Pack",
    description: "Optimized for IG, TikTok & Stories",
    icon: "📱",
    variations: [
      // Instagram Feed (1:1 and 4:5)
      { type: "ig_feed_1", promptSuffix: "Instagram-worthy product shot, aesthetic, highly shareable", aspectRatio: "1:1" },
      { type: "ig_feed_2", promptSuffix: "Instagram lifestyle post, aspirational, engagement-focused", aspectRatio: "4:5" },
      { type: "ig_feed_3", promptSuffix: "Instagram aesthetic flat lay, curated items, pleasing composition", aspectRatio: "1:1" },
      // Stories (9:16)
      { type: "story_1", promptSuffix: "Instagram Story format, vertical, eye-catching, swipe-up ready", aspectRatio: "9:16" },
      { type: "story_2", promptSuffix: "Story-friendly product showcase, bold, quick-glance appeal", aspectRatio: "9:16" },
      { type: "story_3", promptSuffix: "Behind-the-scenes style Story, authentic, casual feel", aspectRatio: "9:16" },
      // TikTok/Reels covers
      { type: "tiktok_1", promptSuffix: "TikTok cover image, attention-grabbing, vertical format", aspectRatio: "9:16" },
      { type: "tiktok_2", promptSuffix: "Viral-worthy product shot, bold colors, Gen-Z aesthetic", aspectRatio: "9:16" },
      { type: "tiktok_3", promptSuffix: "TikTok unboxing style, excitement, anticipation", aspectRatio: "9:16" },
    ],
  },
};

/**
 * Generate enhanced prompts for a product based on selected pack
 */
export function generateImagePrompts(
  productDescription: string,
  pack: ImagePack
): Array<{ prompt: string; aspectRatio: string; type: string }> {
  const config = IMAGE_PACKS[pack];
  
  return config.variations.map((variation) => ({
    prompt: `${productDescription}, ${variation.promptSuffix}`,
    aspectRatio: variation.aspectRatio,
    type: variation.type,
  }));
}

/**
 * Get pack recommendation based on product description
 */
export function recommendPack(productDescription: string): ImagePack {
  const lower = productDescription.toLowerCase();
  
  if (lower.includes("ad") || lower.includes("sale") || lower.includes("promo")) {
    return "ads";
  }
  if (lower.includes("instagram") || lower.includes("tiktok") || lower.includes("social")) {
    return "social";
  }
  if (lower.includes("lifestyle") || lower.includes("use") || lower.includes("action")) {
    return "lifestyle";
  }
  if (lower.includes("product") || lower.includes("listing") || lower.includes("amazon")) {
    return "product";
  }
  
  return "auto"; // Best default
}
