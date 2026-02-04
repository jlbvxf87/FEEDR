"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { cn } from "@/lib/utils";

interface TrendAnalysis {
  hook_patterns: Array<{
    pattern: string;
    examples: string[];
    frequency: number;
  }>;
  recommended_hooks: Array<{
    hook: string;
    reasoning: string;
  }>;
  content_structure: {
    avg_duration_seconds: number;
    common_formats: string[];
  };
}

interface ResearchPanelProps {
  query: string;
  onUseHook: (hook: string) => void;
  onClose: () => void;
}

export function ResearchPanel({ query, onUseHook, onClose }: ResearchPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<TrendAnalysis | null>(null);
  const [videosFound, setVideosFound] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleResearch = async () => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke("research", {
        body: { query: query.trim(), platform: "tiktok", limit: 20 },
      });

      if (error) throw error;

      setAnalysis(data.analysis);
      setVideosFound(data.videos_found);
    } catch (err) {
      console.error("Research error:", err);
      setError(err instanceof Error ? err.message : "Research failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="relative w-full max-w-lg max-h-[80vh] bg-[#0B0E11] rounded-t-2xl sm:rounded-2xl border border-[#1C2230] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1C2230]">
          <div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              Trend Research
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Powered by Clawdbot
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#6B7280] hover:text-white transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {!analysis && !isLoading && (
            <div className="text-center py-8">
              <p className="text-sm text-[#9CA3AF] mb-4">
                Research trending content for:
              </p>
              <p className="text-white font-medium mb-6 px-4">
                "{query}"
              </p>
              <button
                onClick={handleResearch}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#2EE6C9] to-[#0095FF] text-[#0B0E11] font-semibold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity"
              >
                🔍 Find Trending Hooks
              </button>
            </div>
          )}

          {isLoading && (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-2 text-[#2EE6C9]">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Analyzing TikTok trends...</span>
              </div>
              <p className="text-xs text-[#6B7280] mt-2">
                This may take 30-60 seconds
              </p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-500 text-sm mb-4">{error}</p>
              <button
                onClick={handleResearch}
                className="text-xs text-[#2EE6C9] underline"
              >
                Try again
              </button>
            </div>
          )}

          {analysis && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-[#6B7280]">
                <span>📊 Analyzed {videosFound} videos</span>
              </div>

              {/* Recommended Hooks */}
              <div>
                <h3 className="text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-3">
                  Recommended Hooks
                </h3>
                <div className="space-y-2">
                  {analysis.recommended_hooks?.slice(0, 5).map((item, index) => (
                    <div
                      key={index}
                      className="bg-[#1C2230] rounded-lg p-3 group"
                    >
                      <p className="text-sm text-white mb-1">
                        "{item.hook}"
                      </p>
                      <p className="text-xs text-[#6B7280] mb-2">
                        {item.reasoning}
                      </p>
                      <button
                        onClick={() => onUseHook(item.hook)}
                        className="text-xs text-[#2EE6C9] hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Use this hook →
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hook Patterns */}
              {analysis.hook_patterns && analysis.hook_patterns.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-3">
                    Common Hook Patterns
                  </h3>
                  <div className="space-y-2">
                    {analysis.hook_patterns.slice(0, 3).map((pattern, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-[#1C2230] rounded-lg px-3 py-2"
                      >
                        <span className="text-sm text-white">{pattern.pattern}</span>
                        <span className="text-xs text-[#6B7280]">
                          {Math.round(pattern.frequency * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Content Structure */}
              {analysis.content_structure && (
                <div>
                  <h3 className="text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-3">
                    Content Insights
                  </h3>
                  <div className="bg-[#1C2230] rounded-lg p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#6B7280]">Avg Duration</span>
                      <span className="text-white">
                        {analysis.content_structure.avg_duration_seconds}s
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#6B7280]">Common Formats</span>
                      <span className="text-white text-right text-xs">
                        {analysis.content_structure.common_formats?.slice(0, 2).join(", ")}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
