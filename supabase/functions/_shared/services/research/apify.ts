// FEEDR - Apify TikTok Research Service
// Uses Apify for TikTok video scraping and Claude for analysis

import { 
  ResearchService, 
  ScrapedVideo, 
  TrendAnalysis, 
  ResearchParams,
  RESEARCH_ANALYSIS_PROMPT 
} from "./interface.ts";

const APIFY_API_URL = "https://api.apify.com/v2";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

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

  async searchVideos(params: ResearchParams): Promise<ScrapedVideo[]> {
    const { query, limit = 20, sort_by = "views" } = params;
    
    try {
      // Start the Apify TikTok scraper actor
      const runResponse = await fetch(
        `${APIFY_API_URL}/acts/clockworks~tiktok-scraper/runs?token=${this.apifyToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            searchQueries: [query],
            resultsPerPage: limit,
            shouldDownloadVideos: false,
            shouldDownloadCovers: false,
            shouldDownloadSubtitles: true, // Get captions if available
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
      const maxAttempts = 60; // 5 minutes max
      let results: any[] = [];
      
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000)); // 5s polling
        attempts++;
        
        const statusResponse = await fetch(
          `${APIFY_API_URL}/actor-runs/${runId}?token=${this.apifyToken}`
        );
        
        if (!statusResponse.ok) continue;
        
        const { data: statusData } = await statusResponse.json();
        
        if (statusData.status === "SUCCEEDED") {
          // Fetch results from dataset
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

      // Transform Apify results to our ScrapedVideo format
      const videos: ScrapedVideo[] = results.map((item: any) => ({
        id: item.id || item.videoId,
        url: `https://tiktok.com/@${item.authorMeta?.name}/video/${item.id}`,
        platform: "tiktok" as const,
        author_username: item.authorMeta?.name || item.author || "",
        caption: item.text || item.description || "",
        transcript: item.subtitles || "",
        views: item.playCount || item.stats?.playCount || 0,
        likes: item.diggCount || item.stats?.diggCount || 0,
        comments: item.commentCount || item.stats?.commentCount || 0,
        shares: item.shareCount || item.stats?.shareCount || 0,
        hashtags: (item.hashtags || []).map((h: any) => h.name || h),
        hook_text: this.extractHook(item.text || ""),
        duration_seconds: item.videoMeta?.duration || item.duration || 0,
        created_at: item.createTime ? new Date(item.createTime * 1000).toISOString() : new Date().toISOString(),
      }));

      // Sort by requested criteria
      if (sort_by === "views") {
        videos.sort((a, b) => b.views - a.views);
      } else if (sort_by === "likes") {
        videos.sort((a, b) => b.likes - a.likes);
      }

      return videos.slice(0, limit);
      
    } catch (error) {
      console.error("Apify TikTok scraping failed:", error);
      throw error;
    }
  }

  async analyzeVideos(query: string, videos: ScrapedVideo[]): Promise<TrendAnalysis> {
    try {
      // Prepare video data for analysis
      const videoSummaries = videos.slice(0, 15).map(v => ({
        caption: v.caption,
        hook: v.hook_text,
        views: v.views,
        likes: v.likes,
        duration: v.duration_seconds,
        hashtags: v.hashtags.slice(0, 5),
      }));

      const prompt = RESEARCH_ANALYSIS_PROMPT
        .replace("{{query}}", query)
        + `\n\nVideos to analyze:\n${JSON.stringify(videoSummaries, null, 2)}`;

      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "x-api-key": this.anthropicKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-sonnet-20240229",
          max_tokens: 2000,
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

      return JSON.parse(jsonMatch[0]) as TrendAnalysis;
      
    } catch (error) {
      console.error("Clawdbot analysis failed:", error);
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
