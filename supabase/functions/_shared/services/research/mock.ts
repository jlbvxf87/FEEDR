// FEEDR - Mock Research Service
// Used for development and testing

import { 
  ResearchService, 
  ScrapedVideo, 
  TrendAnalysis, 
  ResearchParams 
} from "./interface.ts";

// Mock scraped videos
const MOCK_VIDEOS: ScrapedVideo[] = [
  {
    id: "mock-1",
    url: "https://tiktok.com/@creator1/video/123",
    platform: "tiktok",
    author_username: "creator1",
    caption: "This changed my business forever #business #entrepreneur",
    views: 2500000,
    likes: 180000,
    comments: 4500,
    shares: 12000,
    hashtags: ["business", "entrepreneur", "startup"],
    hook_text: "Nobody talks about this but...",
    duration_seconds: 45,
    created_at: new Date().toISOString(),
  },
  {
    id: "mock-2",
    url: "https://tiktok.com/@creator2/video/456",
    platform: "tiktok",
    author_username: "creator2",
    caption: "I went from $0 to $100k doing this #money #sidehustle",
    views: 1800000,
    likes: 120000,
    comments: 3200,
    shares: 8500,
    hashtags: ["money", "sidehustle", "income"],
    hook_text: "Stop scrolling if you want to make money",
    duration_seconds: 60,
    created_at: new Date().toISOString(),
  },
  {
    id: "mock-3",
    url: "https://tiktok.com/@creator3/video/789",
    platform: "tiktok",
    author_username: "creator3",
    caption: "The truth about starting a business in 2024 #realtalk",
    views: 3200000,
    likes: 250000,
    comments: 6800,
    shares: 15000,
    hashtags: ["realtalk", "business", "advice"],
    hook_text: "Here's what they don't tell you...",
    duration_seconds: 35,
    created_at: new Date().toISOString(),
  },
];

export class MockResearchService implements ResearchService {
  readonly name = "mock";
  readonly supportedPlatforms = ["tiktok", "instagram", "youtube"];

  async searchVideos(params: ResearchParams): Promise<ScrapedVideo[]> {
    const { limit = 10 } = params;
    
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));
    
    // Return mock videos with query-customized captions
    return MOCK_VIDEOS.slice(0, limit).map((video, index) => ({
      ...video,
      id: `mock-${index}-${Date.now()}`,
      caption: video.caption.replace("business", params.query.split(" ")[0]),
    }));
  }

  async analyzeVideos(query: string, videos: ScrapedVideo[]): Promise<TrendAnalysis> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 400));
    
    return {
      hook_patterns: [
        {
          pattern: "Nobody talks about this but...",
          examples: ["Nobody talks about the downside of...", "Nobody mentions that..."],
          frequency: 0.35,
        },
        {
          pattern: "Stop scrolling if...",
          examples: ["Stop scrolling if you want to...", "Stop scrolling if you're dealing with..."],
          frequency: 0.25,
        },
        {
          pattern: "Here's what they don't tell you...",
          examples: ["Here's what no one tells you about...", "What they don't show you is..."],
          frequency: 0.20,
        },
        {
          pattern: "I went from X to Y...",
          examples: ["I went from broke to...", "I went from 0 followers to..."],
          frequency: 0.15,
        },
        {
          pattern: "POV: You just discovered...",
          examples: ["POV: You finally found...", "POV: Someone just told you..."],
          frequency: 0.05,
        },
      ],
      content_structure: {
        avg_duration_seconds: 45,
        common_formats: ["talking head", "screen recording", "B-roll montage"],
        pacing: "Fast hooks (2-3s), medium middle, strong CTA ending",
      },
      visual_style: {
        common_elements: ["text overlays", "zoom effects", "split screens"],
        lighting: "Natural/ring light mix",
        camera_work: "Handheld feel, slight movement",
      },
      engagement_drivers: [
        "Curiosity gap in hook",
        "Relatable problem statement",
        "Promise of valuable information",
        "Controversy or hot take",
        "Personal story element",
      ],
      recommended_hooks: [
        {
          hook: `Nobody talks about the dark side of ${query}...`,
          reasoning: "Creates curiosity gap and implies insider knowledge",
        },
        {
          hook: `I tested ${query} for 30 days - here's what happened`,
          reasoning: "Personal experience + specific timeframe builds credibility",
        },
        {
          hook: `Stop scrolling if you're struggling with ${query}`,
          reasoning: "Direct address + pain point creates immediate relevance",
        },
        {
          hook: `The ${query} mistake that's costing you money`,
          reasoning: "Loss aversion + specific problem drives engagement",
        },
        {
          hook: `POV: You just discovered the truth about ${query}`,
          reasoning: "Immersive format + promise of revelation",
        },
      ],
    };
  }
}
