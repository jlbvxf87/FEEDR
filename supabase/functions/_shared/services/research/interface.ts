// FEEDR - Research Service Interface
// Abstraction layer for content research (TikTok scraping, trend analysis)

export interface ScrapedVideo {
  id: string;
  url: string;
  platform: "tiktok" | "instagram" | "youtube";
  author_username: string;
  caption: string;
  transcript?: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  hashtags: string[];
  hook_text?: string; // First 3 seconds transcript
  duration_seconds: number;
  created_at: string;
}

export interface TrendAnalysis {
  hook_patterns: Array<{
    pattern: string;
    examples: string[];
    frequency: number;
  }>;
  content_structure: {
    avg_duration_seconds: number;
    common_formats: string[];
    pacing: string;
  };
  visual_style: {
    common_elements: string[];
    lighting: string;
    camera_work: string;
  };
  engagement_drivers: string[];
  recommended_hooks: Array<{
    hook: string;
    reasoning: string;
  }>;
}

export interface ResearchOutput {
  videos: ScrapedVideo[];
  analysis: TrendAnalysis;
}

export interface ResearchParams {
  query: string;
  platform?: "tiktok" | "instagram" | "youtube" | "all";
  limit?: number; // max videos to scrape
  sort_by?: "views" | "likes" | "recent";
  /** Detected category for targeted scraping */
  category?: ContentCategory;
  /** Minimum views to be considered "viral" */
  min_views?: number;
  /** Minimum engagement rate (likes/views) */
  min_engagement_rate?: number;
}

// =============================================================================
// CONTENT CATEGORIES - Smart detection from user prompts
// =============================================================================

export type ContentCategory = 
  | "health_wellness"
  | "finance_money"
  | "beauty_skincare"
  | "fitness_gym"
  | "food_cooking"
  | "tech_gadgets"
  | "business_entrepreneur"
  | "lifestyle_fashion"
  | "education_learning"
  | "entertainment_comedy"
  | "relationships_dating"
  | "parenting_family"
  | "travel_adventure"
  | "real_estate"
  | "automotive"
  | "gaming"
  | "general";

/**
 * Category detection patterns - maps keywords to categories
 * When user mentions "glp", "ozempic", "weight loss" → health_wellness
 */
/**
 * CATEGORY CONFIG - Optimized for finding ONLY viral, high-performing content
 * 
 * IMPORTANT: We set HIGH viral thresholds because:
 * 1. We want to learn from PROVEN winners only
 * 2. Low-view videos teach bad habits
 * 3. Higher bar = better hooks, better scripts, more wins for users
 */
export const CATEGORY_DETECTION: Record<ContentCategory, {
  keywords: string[];
  hashtags: string[];           // Top trending hashtags in this niche
  trending_hashtags: string[];  // Currently trending/hot hashtags
  min_viral_views: number;      // MINIMUM views to be considered (HIGH bar)
  elite_viral_views: number;    // Elite tier - top 1% content
  description: string;
  niche_terms: string[];        // Exact creator terminology
}> = {
  health_wellness: {
    keywords: ["glp", "ozempic", "wegovy", "semaglutide", "mounjaro", "tirzepatide", "weight loss", "weightloss", "health", "wellness", "diet", "nutrition", "supplements", "vitamins", "mental health", "anxiety", "depression", "therapy", "healing", "hormone", "gut health", "inflammation", "biohacking", "longevity", "peptides", "zepbound"],
    hashtags: ["weightloss", "glp1", "ozempic", "healthtok", "wellness", "mentalhealth", "ozempicweightloss", "glp1weightloss"],
    trending_hashtags: ["ozempicjourney", "semaglutide", "mounjaro", "wegovy", "glp1agonist", "weightlosstransformation"],
    min_viral_views: 500000,     // 500K+ only - this niche is HUGE
    elite_viral_views: 2000000,  // 2M+ for elite
    description: "Health, wellness, weight loss (GLP-1, ozempic), supplements, mental health",
    niche_terms: ["my ozempic journey", "glp-1 results", "week 1 on", "semaglutide update", "mounjaro week"]
  },
  finance_money: {
    keywords: ["money", "finance", "invest", "stocks", "crypto", "bitcoin", "trading", "passive income", "side hustle", "wealth", "rich", "millionaire", "debt", "credit", "budget", "savings", "retirement", "401k", "real estate investing", "dividend", "etf", "index fund"],
    hashtags: ["moneytok", "financetok", "investing", "stockmarket", "crypto", "passiveincome", "sidehustle", "wealthbuilding"],
    trending_hashtags: ["moneymaking", "makemoney", "financialfreedom", "stocktok", "investingtips"],
    min_viral_views: 500000,     // 500K+ - finance is competitive
    elite_viral_views: 3000000,  // 3M+ for elite
    description: "Personal finance, investing, side hustles, wealth building",
    niche_terms: ["how I made", "passive income stream", "side hustle that", "quit my 9-5", "financial freedom"]
  },
  beauty_skincare: {
    keywords: ["skincare", "makeup", "beauty", "skin", "acne", "wrinkles", "aging", "glow", "routine", "serum", "retinol", "sunscreen", "moisturizer", "cleanser", "dermatologist", "esthetician", "cosmetics", "nails", "hair", "tretinoin"],
    hashtags: ["skincare", "beautytok", "makeup", "skincareroutine", "glowup", "beautyhacks", "skintok", "grwm"],
    trending_hashtags: ["glasskin", "skincaretips", "acnejourney", "antiaging", "skinfluencer"],
    min_viral_views: 750000,     // 750K+ - beauty is massive
    elite_viral_views: 5000000,  // 5M+ for elite
    description: "Skincare, makeup, beauty tips, routines",
    niche_terms: ["my skin cleared", "holy grail product", "dermatologist approved", "glass skin routine"]
  },
  fitness_gym: {
    keywords: ["gym", "workout", "fitness", "muscle", "gains", "lift", "strength", "cardio", "running", "yoga", "pilates", "crossfit", "bodybuilding", "protein", "bulk", "cut", "shred", "abs", "glutes", "leg day", "pr"],
    hashtags: ["gymtok", "fitness", "workout", "gym", "fitnesstips", "strengthtraining", "fitfam", "gains"],
    trending_hashtags: ["gymmotivation", "workoutroutine", "fitnessjourney", "liftingweights", "glutegrowth"],
    min_viral_views: 500000,     // 500K+
    elite_viral_views: 3000000,  // 3M+ for elite
    description: "Gym, workouts, fitness tips, bodybuilding",
    niche_terms: ["gym transformation", "what I eat", "full workout", "leg day routine", "how I grew my"]
  },
  food_cooking: {
    keywords: ["recipe", "cooking", "food", "meal prep", "restaurant", "chef", "kitchen", "baking", "dinner", "lunch", "breakfast", "snack", "healthy eating", "foodie", "cuisine", "ingredients", "air fryer"],
    hashtags: ["foodtok", "recipe", "cooking", "foodie", "mealprep", "recipes", "cookingtiktok", "whatieatinaday"],
    trending_hashtags: ["easyrecipe", "airfryerrecipe", "foodhack", "cookinghack", "viralrecipe"],
    min_viral_views: 1000000,    // 1M+ - food is HUGE on TikTok
    elite_viral_views: 10000000, // 10M+ for elite
    description: "Recipes, cooking tips, restaurants, food content",
    niche_terms: ["recipe you need", "easiest recipe", "this went viral", "you have to try", "game changer"]
  },
  tech_gadgets: {
    keywords: ["tech", "gadget", "iphone", "android", "app", "software", "ai", "artificial intelligence", "robot", "computer", "laptop", "phone", "smartwatch", "airpods", "gadgets", "productivity", "notion", "chatgpt", "apple"],
    hashtags: ["techtok", "techreview", "gadgets", "technology", "apple", "iphone", "ai", "productivityhacks"],
    trending_hashtags: ["techfinds", "amazonfinds", "iphonehacks", "aihacks", "chatgpthacks"],
    min_viral_views: 300000,     // 300K+ - tech is niche but engaged
    elite_viral_views: 2000000,  // 2M+ for elite
    description: "Tech reviews, gadgets, apps, AI, productivity",
    niche_terms: ["hidden feature", "you didnt know", "tech hack", "app you need", "iphone trick"]
  },
  business_entrepreneur: {
    keywords: ["business", "entrepreneur", "startup", "founder", "ceo", "company", "brand", "marketing", "sales", "ecommerce", "dropshipping", "amazon", "etsy", "shopify", "agency", "consulting", "client", "revenue", "profit", "saas"],
    hashtags: ["entrepreneur", "business", "startup", "smallbusiness", "businesstiktok", "marketing", "ecommerce", "ceo"],
    trending_hashtags: ["founderstory", "startuplife", "buildingabusiness", "entrepreneurlife", "biztok"],
    min_viral_views: 300000,     // 300K+ - B2B is smaller audience
    elite_viral_views: 1500000,  // 1.5M+ for elite
    description: "Entrepreneurship, startups, business tips, marketing",
    niche_terms: ["built a business", "founder mistake", "startup lesson", "how I scaled", "business advice"]
  },
  lifestyle_fashion: {
    keywords: ["fashion", "style", "outfit", "ootd", "clothes", "wardrobe", "aesthetic", "minimalist", "luxury", "designer", "thrift", "haul", "try on", "capsule wardrobe"],
    hashtags: ["fashion", "ootd", "style", "fashiontiktok", "outfitinspo", "aesthetic", "grwm", "outfitideas"],
    trending_hashtags: ["outfitoftheday", "fashiontrends", "styleinspo", "whatiwore", "fashionhaul"],
    min_viral_views: 750000,     // 750K+ - fashion is massive
    elite_viral_views: 5000000,  // 5M+ for elite
    description: "Fashion, style, outfits, lifestyle aesthetic",
    niche_terms: ["outfit idea", "style tip", "how to style", "wardrobe staple", "fashion find"]
  },
  education_learning: {
    keywords: ["learn", "education", "school", "college", "study", "tips", "hack", "tutorial", "how to", "explain", "teach", "course", "degree", "career", "job", "interview", "resume"],
    hashtags: ["learntok", "education", "studytok", "careertiktok", "learnontiktok", "studytips", "edutok"],
    trending_hashtags: ["studywithme", "learnwithme", "interviewtips", "careertips", "studyhacks"],
    min_viral_views: 300000,     // 300K+
    elite_viral_views: 2000000,  // 2M+ for elite
    description: "Education, learning, career tips, tutorials",
    niche_terms: ["learn this", "explained simply", "how to actually", "study tip", "career hack"]
  },
  entertainment_comedy: {
    keywords: ["funny", "comedy", "joke", "prank", "skit", "meme", "viral", "trend", "challenge", "duet", "reaction", "storytime", "drama", "tea"],
    hashtags: ["comedy", "funny", "viral", "fyp", "meme", "storytime", "prank", "trending"],
    trending_hashtags: ["foryou", "foryoupage", "viralvideo", "funnyvideos", "comedytiktok"],
    min_viral_views: 2000000,    // 2M+ - entertainment bar is VERY high
    elite_viral_views: 10000000, // 10M+ for elite
    description: "Comedy, entertainment, viral trends, storytimes",
    niche_terms: ["storytime", "pov", "wait for it", "you wont believe", "this is crazy"]
  },
  relationships_dating: {
    keywords: ["dating", "relationship", "love", "marriage", "boyfriend", "girlfriend", "husband", "wife", "dating app", "tinder", "hinge", "red flag", "green flag", "toxic", "situationship", "breakup", "divorce"],
    hashtags: ["relationshiptok", "datingadvice", "relationships", "love", "datingtips", "couples", "datinglife"],
    trending_hashtags: ["relationshipadvice", "datingin2024", "couplegoals", "toxicrelationship", "redflag"],
    min_viral_views: 500000,     // 500K+
    elite_viral_views: 3000000,  // 3M+ for elite
    description: "Dating advice, relationships, love, marriage",
    niche_terms: ["red flag", "green flag", "dating advice", "relationship tip", "if he does this"]
  },
  parenting_family: {
    keywords: ["mom", "dad", "parent", "baby", "toddler", "kid", "children", "family", "pregnancy", "newborn", "motherhood", "fatherhood", "parenting tips", "nursery"],
    hashtags: ["momtok", "parenting", "momsoftiktok", "baby", "familytok", "parentingtips", "momlife"],
    trending_hashtags: ["newmom", "toddlermom", "momhack", "parentinghack", "dadlife"],
    min_viral_views: 500000,     // 500K+
    elite_viral_views: 3000000,  // 3M+ for elite
    description: "Parenting, family, babies, motherhood",
    niche_terms: ["mom hack", "parenting tip", "newborn must have", "toddler trick", "as a mom"]
  },
  travel_adventure: {
    keywords: ["travel", "vacation", "trip", "flight", "hotel", "airbnb", "destination", "beach", "hiking", "adventure", "backpacking", "europe", "asia", "cruise", "resort"],
    hashtags: ["traveltok", "travel", "vacation", "travelguide", "wanderlust", "adventure", "travellife"],
    trending_hashtags: ["traveltips", "hiddengem", "budgettravel", "travelitinerary", "placestovisit"],
    min_viral_views: 750000,     // 750K+
    elite_viral_views: 5000000,  // 5M+ for elite
    description: "Travel tips, destinations, vacation content",
    niche_terms: ["hidden gem", "travel tip", "must visit", "places to go", "how to travel"]
  },
  real_estate: {
    keywords: ["real estate", "house", "home", "apartment", "rent", "mortgage", "property", "realtor", "buying", "selling", "first time buyer", "housing market", "home tour"],
    hashtags: ["realestate", "housetour", "realtor", "homebuying", "realestatetiktok", "housetok", "hometour"],
    trending_hashtags: ["firsttimehomebuyer", "dreamhome", "housingmarket", "luxuryhome", "homebuyer"],
    min_viral_views: 300000,     // 300K+
    elite_viral_views: 2000000,  // 2M+ for elite
    description: "Real estate, home buying, property, housing",
    niche_terms: ["house tour", "first time buyer", "home buying tip", "realtor advice", "dream home"]
  },
  automotive: {
    keywords: ["car", "truck", "vehicle", "driving", "tesla", "ev", "electric", "mechanic", "dealer", "lease", "auto", "detailing", "mod", "racing"],
    hashtags: ["cartok", "cars", "automotive", "carreview", "tesla", "carsoftiktok", "carlife"],
    trending_hashtags: ["newcar", "cardealership", "cardetailing", "teslatips", "carbuyingtips"],
    min_viral_views: 500000,     // 500K+
    elite_viral_views: 3000000,  // 3M+ for elite
    description: "Cars, automotive, reviews, car content",
    niche_terms: ["car review", "dont buy", "before buying", "car hack", "detailing tip"]
  },
  gaming: {
    keywords: ["game", "gaming", "gamer", "playstation", "xbox", "nintendo", "pc", "stream", "twitch", "esports", "fortnite", "minecraft", "cod", "valorant"],
    hashtags: ["gaming", "gamer", "gamingtiktok", "gameplay", "videogames", "twitch", "gamingclips"],
    trending_hashtags: ["gamingmoments", "epicgaming", "gamerhacks", "gamingsetup", "pcgaming"],
    min_viral_views: 750000,     // 750K+
    elite_viral_views: 5000000,  // 5M+ for elite
    description: "Gaming, video games, streaming, esports",
    niche_terms: ["gaming clip", "how to beat", "best weapon", "gaming hack", "insane play"]
  },
  general: {
    keywords: [],
    hashtags: ["fyp", "viral", "trending", "foryou"],
    trending_hashtags: ["foryoupage", "viralvideo", "trending", "blowthisup"],
    min_viral_views: 500000,     // 500K+ minimum
    elite_viral_views: 3000000,  // 3M+ for elite
    description: "General content, no specific category",
    niche_terms: []
  }
};

/**
 * Detect category from user prompt
 * Returns the best matching category based on keyword matches
 */
export function detectCategory(prompt: string): ContentCategory {
  const lowerPrompt = prompt.toLowerCase();
  let bestMatch: ContentCategory = "general";
  let highestScore = 0;
  
  for (const [category, config] of Object.entries(CATEGORY_DETECTION)) {
    if (category === "general") continue;
    
    let score = 0;
    for (const keyword of config.keywords) {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        // Longer keywords get higher weight (more specific)
        score += keyword.length;
      }
    }
    
    if (score > highestScore) {
      highestScore = score;
      bestMatch = category as ContentCategory;
    }
  }
  
  return bestMatch;
}

/**
 * Get category-specific hashtags for better search targeting
 */
export function getCategoryHashtags(category: ContentCategory): string[] {
  return CATEGORY_DETECTION[category]?.hashtags || CATEGORY_DETECTION.general.hashtags;
}

/**
 * Get viral threshold for category
 */
export function getViralThreshold(category: ContentCategory): number {
  return CATEGORY_DETECTION[category]?.min_viral_views || 100000;
}

export interface ResearchService {
  /** Service identifier */
  readonly name: string;
  
  /** Supported platforms */
  readonly supportedPlatforms: string[];
  
  /**
   * Search and scrape VIRAL videos matching query
   * Only returns videos above viral threshold
   */
  searchVideos(params: ResearchParams): Promise<ScrapedVideo[]>;
  
  /**
   * Analyze scraped videos for patterns and insights
   * Uses Claude Sonnet for deep pattern extraction
   */
  analyzeVideos(query: string, videos: ScrapedVideo[], category?: ContentCategory): Promise<TrendAnalysis>;
}

// Analysis prompt for Clawdbot - OPTIMIZED for efficiency
export const RESEARCH_ANALYSIS_PROMPT = `You are an expert at analyzing VIRAL TikTok content. These videos have {{view_count}}+ views.

Topic: "{{query}}"
Category: {{category}}

ANALYZE these proven winners and extract ACTIONABLE patterns:

1. HOOKS (first 3 seconds) - The exact formulas that made these go viral
2. STRUCTURE - Duration, format, pacing that works
3. ENGAGEMENT - Why people watch, share, comment

Based on what ACTUALLY WORKS in this data, generate 5 hook variations to test.

Return JSON:
{
  "hook_patterns": [{"pattern": "...", "examples": ["...", "..."], "frequency": 0.35}],
  "content_structure": {"avg_duration_seconds": 30, "common_formats": ["..."], "pacing": "..."},
  "visual_style": {"common_elements": ["..."], "lighting": "...", "camera_work": "..."},
  "engagement_drivers": ["curiosity", "fomo", "..."],
  "recommended_hooks": [{"hook": "...", "reasoning": "based on pattern X which had Y% frequency"}]
}`;

/**
 * Build analysis prompt with actual data
 */
export function buildAnalysisPrompt(query: string, category: ContentCategory, avgViews: number): string {
  return RESEARCH_ANALYSIS_PROMPT
    .replace("{{query}}", query)
    .replace("{{category}}", category)
    .replace("{{view_count}}", Math.round(avgViews).toLocaleString());
}
