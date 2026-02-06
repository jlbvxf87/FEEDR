// FEEDR - Apify TikTok Research Service
// Uses Apify for TikTok video scraping and Claude for analysis
// ENHANCED: Smart category detection + viral thresholds

import { 
  ResearchService, 
  ScrapedVideo, 
  TrendAnalysis, 
  ResearchParams,
  buildAnalysisPrompt,
  ContentCategory,
  detectCategory,
  getCategoryHashtags,
  getViralThreshold,
  CATEGORY_DETECTION,
} from "./interface.ts";

const APIFY_API_URL = "https://api.apify.com/v2";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// Default viral thresholds
const DEFAULT_MIN_VIEWS = 50000;
const DEFAULT_MIN_ENGAGEMENT_RATE = 0.03; // 3% likes/views

export class ApifyResearchService implements ResearchService {
  readonly name = "apify";
  readonly supportedPlatforms = ["tiktok"];
  
  private apifyToken: string;
  private anthropicKey: string;

  constructor() {
    this.apifyToken = Deno.env.get("APIFY_API_TOKEN") || "";
    this.anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
    
    if (!this.apifyToken) {
      console.warn("APIFY_API_TOKEN not set, Apify service will fail");
    }
    if (!this.anthropicKey) {
      console.warn("ANTHROPIC_API_KEY not set, analysis will fail");
    }
  }

  /**
   * SMART SEARCH: Detects category from query and builds targeted search
   */
  async searchVideos(params: ResearchParams): Promise<ScrapedVideo[]> {
    const { query, limit = 20, sort_by = "views" } = params;
    
    // STEP 1: Detect category from query
    const category = params.category || detectCategory(query);
    const categoryConfig = CATEGORY_DETECTION[category];
    
    console.log(`[Apify] Detected category: ${category} (${categoryConfig.description})`);
    
    // STEP 2: Build smart search queries using TRENDING hashtags
    const categoryHashtags = getCategoryHashtags(category);
    const searchQueries = this.buildSmartSearchQueries(query, categoryHashtags, category);
    
    console.log(`[Apify] Smart search queries: ${searchQueries.join(", ")}`);
    
    // STEP 3: Get viral threshold for this category
    const minViews = params.min_views || categoryConfig.min_viral_views || DEFAULT_MIN_VIEWS;
    const minEngagement = params.min_engagement_rate || DEFAULT_MIN_ENGAGEMENT_RATE;
    
    console.log(`[Apify] Viral threshold: ${minViews.toLocaleString()} views, ${(minEngagement * 100).toFixed(1)}% engagement`);
    
    try {
      // Request MORE videos than needed so we can filter for viral only
      const requestLimit = Math.min(limit * 3, 50); // Get 3x to filter down
      
      // Start the Apify TikTok scraper actor with smart queries
      const runResponse = await fetch(
        `${APIFY_API_URL}/acts/clockworks~tiktok-scraper/runs?token=${this.apifyToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            searchQueries: searchQueries,
            resultsPerPage: Math.ceil(requestLimit / searchQueries.length),
            shouldDownloadVideos: false,
            shouldDownloadCovers: false,
            shouldDownloadSubtitles: true,
          }),
        }
      );

      if (!runResponse.ok) {
        const error = await runResponse.text();
        throw new Error(`Apify run error: ${runResponse.status} - ${error}`);
      }

      const { data: runData } = await runResponse.json();
      const runId = runData.id;
      
      // Poll for completion
      let attempts = 0;
      const maxAttempts = 60;
      let results: any[] = [];
      
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000));
        attempts++;
        
        const statusResponse = await fetch(
          `${APIFY_API_URL}/actor-runs/${runId}?token=${this.apifyToken}`
        );
        
        if (!statusResponse.ok) continue;
        
        const { data: statusData } = await statusResponse.json();
        
        if (statusData.status === "SUCCEEDED") {
          const datasetResponse = await fetch(
            `${APIFY_API_URL}/datasets/${statusData.defaultDatasetId}/items?token=${this.apifyToken}`
          );
          
          if (datasetResponse.ok) {
            results = await datasetResponse.json();
          }
          break;
        } else if (statusData.status === "FAILED" || statusData.status === "ABORTED") {
          throw new Error(`Apify scraper ${statusData.status}`);
        }
      }

      console.log(`[Apify] Raw results: ${results.length} videos`);

      // STEP 4: Transform and FILTER for viral videos only
      const allVideos: ScrapedVideo[] = results.map((item: any) => {
        const views = item.playCount || item.stats?.playCount || 0;
        const likes = item.diggCount || item.stats?.diggCount || 0;
        const engagementRate = views > 0 ? likes / views : 0;
        
        return {
          id: item.id || item.videoId,
          url: `https://tiktok.com/@${item.authorMeta?.name}/video/${item.id}`,
          platform: "tiktok" as const,
          author_username: item.authorMeta?.name || item.author || "",
          caption: item.text || item.description || "",
          transcript: item.subtitles || "",
          views,
          likes,
          comments: item.commentCount || item.stats?.commentCount || 0,
          shares: item.shareCount || item.stats?.shareCount || 0,
          hashtags: (item.hashtags || []).map((h: any) => h.name || h),
          hook_text: this.extractHook(item.text || ""),
          duration_seconds: item.videoMeta?.duration || item.duration || 0,
          created_at: item.createTime ? new Date(item.createTime * 1000).toISOString() : new Date().toISOString(),
          // Add engagement rate for filtering
          _engagement_rate: engagementRate,
        };
      });

      // STEP 5: Filter for VIRAL videos only
      const viralVideos = allVideos.filter(v => {
        const isViral = v.views >= minViews;
        const hasGoodEngagement = (v as any)._engagement_rate >= minEngagement;
        const isRelevant = this.isRelevantToCategory(v, category, query);
        
        return isViral && hasGoodEngagement && isRelevant;
      });

      console.log(`[Apify] After viral filter: ${viralVideos.length} videos (min ${minViews.toLocaleString()} views)`);

      // STEP 6: Sort and return top results
      if (sort_by === "views") {
        viralVideos.sort((a, b) => b.views - a.views);
      } else if (sort_by === "likes") {
        viralVideos.sort((a, b) => b.likes - a.likes);
      }

      // Remove internal fields before returning
      const cleanVideos = viralVideos.map(v => {
        const { _engagement_rate, ...clean } = v as any;
        return clean as ScrapedVideo;
      });

      const finalVideos = cleanVideos.slice(0, limit);
      
      console.log(`[Apify] Returning ${finalVideos.length} viral videos for category: ${category}`);
      if (finalVideos.length > 0) {
        const avgViews = finalVideos.reduce((s, v) => s + v.views, 0) / finalVideos.length;
        console.log(`[Apify] Average views: ${Math.round(avgViews).toLocaleString()}`);
      }

      return finalVideos;
      
    } catch (error) {
      console.error("Apify TikTok scraping failed:", error);
      throw error;
    }
  }

  /**
   * Build smart search queries combining user query with TRENDING hashtags
   * Prioritizes trending hashtags for more viral content
   */
  private buildSmartSearchQueries(userQuery: string, categoryHashtags: string[], category: ContentCategory): string[] {
    const queries: string[] = [];
    const categoryConfig = CATEGORY_DETECTION[category];
    
    // Get trending hashtags (higher priority than regular hashtags)
    const trendingHashtags = categoryConfig?.trending_hashtags || [];
    const nicheTerms = categoryConfig?.niche_terms || [];
    
    // PRIMARY: User's query + top trending hashtag (most targeted)
    if (trendingHashtags.length > 0) {
      queries.push(`${userQuery} #${trendingHashtags[0]}`);
    } else {
      queries.push(userQuery);
    }
    
    // SECONDARY: Trending hashtags combo (catches viral trends)
    if (trendingHashtags.length >= 2) {
      queries.push(`#${trendingHashtags[0]} #${trendingHashtags[1]}`);
    }
    
    // TERTIARY: Niche-specific term + trending (captures creator language)
    if (nicheTerms.length > 0 && trendingHashtags.length > 0) {
      queries.push(`${nicheTerms[0]} #${trendingHashtags[0]}`);
    } else if (categoryHashtags.length >= 2) {
      queries.push(`#${categoryHashtags[0]} #${categoryHashtags[1]}`);
    }
    
    console.log(`[Apify] Smart queries built: ${queries.join(" | ")}`);
    
    return queries.slice(0, 3); // Max 3 queries for efficiency
  }

  /**
   * Check if video is relevant to the detected category
   * Filters out off-topic results
   */
  private isRelevantToCategory(video: ScrapedVideo, category: ContentCategory, originalQuery: string): boolean {
    // Always include if it matches original query
    const caption = video.caption.toLowerCase();
    const queryWords = originalQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    const matchesQuery = queryWords.some(word => caption.includes(word));
    if (matchesQuery) return true;
    
    // Check if hashtags match category
    const categoryConfig = CATEGORY_DETECTION[category];
    if (!categoryConfig) return true;
    
    const videoHashtags = (video.hashtags || []).filter(h => typeof h === "string").map(h => h.toLowerCase());
    const categoryHashtags = (categoryConfig.hashtags || []).filter(h => typeof h === "string").map(h => h.toLowerCase());
    
    const hasRelevantHashtag = videoHashtags.some(h => 
      categoryHashtags.some(ch => h.includes(ch) || ch.includes(h))
    );
    if (hasRelevantHashtag) return true;
    
    // Check if caption contains category keywords
    const hasRelevantKeyword = categoryConfig.keywords.some(kw => 
      caption.includes(kw.toLowerCase())
    );
    if (hasRelevantKeyword) return true;
    
    // If none match, filter it out (likely off-topic)
    return false;
  }

  /**
   * EFFICIENT ANALYSIS - Uses Claude Sonnet for deep pattern extraction
   * Only analyzes TOP 10 videos (proven winners) for efficiency
   */
  async analyzeVideos(query: string, videos: ScrapedVideo[], category?: ContentCategory): Promise<TrendAnalysis> {
    try {
      // Calculate average views for context
      const avgViews = videos.reduce((s, v) => s + v.views, 0) / videos.length;
      const detectedCategory = category || detectCategory(query);
      
      // Only analyze TOP 10 videos - more is wasteful
      const topVideos = videos
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);
      
      // Prepare COMPACT video data (reduce tokens)
      const videoSummaries = topVideos.map(v => ({
        hook: v.hook_text?.slice(0, 80) || v.caption.slice(0, 80),
        views: `${Math.round(v.views / 1000)}K`,
        likes: `${Math.round(v.likes / 1000)}K`,
        dur: v.duration_seconds,
        tags: v.hashtags.slice(0, 3).join(","),
      }));

      // Build optimized prompt
      const prompt = buildAnalysisPrompt(query, detectedCategory, avgViews)
        + `\n\nTOP ${topVideos.length} VIRAL VIDEOS:\n${JSON.stringify(videoSummaries, null, 1)}`;

      console.log(`[Apify Analysis] Analyzing ${topVideos.length} videos (avg ${Math.round(avgViews).toLocaleString()} views)`);

      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "x-api-key": this.anthropicKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          // Use Sonnet for best analysis quality
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1500, // Reduced from 2000 - we don't need that much
          messages: [
            { role: "user", content: prompt }
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text;
      
      if (!content) {
        throw new Error("No content in Claude response");
      }

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in Claude response");
      }

      const analysis = JSON.parse(jsonMatch[0]) as TrendAnalysis;
      console.log(`[Apify Analysis] ✅ Found ${analysis.hook_patterns?.length || 0} hook patterns`);
      
      return analysis;
      
    } catch (error) {
      console.error("Analysis failed:", error);
      throw error;
    }
  }

  // Extract the hook (first sentence or phrase) from caption
  private extractHook(caption: string): string {
    // Remove hashtags
    const cleanCaption = caption.replace(/#\w+/g, "").trim();
    
    // Get first sentence or first 100 chars
    const firstSentence = cleanCaption.split(/[.!?]/)[0];
    return firstSentence.slice(0, 100).trim();
  }
}
