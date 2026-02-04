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
}

export interface ResearchService {
  /** Service identifier */
  readonly name: string;
  
  /** Supported platforms */
  readonly supportedPlatforms: string[];
  
  /**
   * Search and scrape videos matching query
   */
  searchVideos(params: ResearchParams): Promise<ScrapedVideo[]>;
  
  /**
   * Analyze scraped videos for patterns and insights
   */
  analyzeVideos(query: string, videos: ScrapedVideo[]): Promise<TrendAnalysis>;
}

// Analysis prompt for Clawdbot
export const RESEARCH_ANALYSIS_PROMPT = `You are Clawdbot, an expert at analyzing viral TikTok/short-form video content.

Given these top-performing videos about "{{query}}", analyze the patterns:

1. **Hook Patterns** - What hooks do these videos use in the first 3 seconds?
   - Identify the top 5 hook formulas with specific examples
   - Note which hooks appear most frequently

2. **Content Structure** - How are these videos formatted?
   - Average length and pacing
   - Common format types (talking head, B-roll, screen recording, etc.)

3. **Visual Style** - What visual elements are common?
   - Lighting style, camera work, text overlays
   - Any consistent aesthetic choices

4. **Engagement Drivers** - What makes these videos shareable?
   - Emotional triggers (curiosity, FOMO, controversy, etc.)
   - Call-to-actions used

5. **Recommended Hooks** - Generate 5 hook variations the user could test
   - Each should be distinct and based on patterns you observed
   - Explain why each hook could work

Return valid JSON matching the TrendAnalysis interface.`;
