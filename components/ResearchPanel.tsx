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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="relative w-full max-w-md bg-[#12161D] rounded-2xl border border-[#2A3241] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A3241]">
          <div>
            <h2 className="text-base font-semibold text-white">
              Trend Research
            </h2>
            <p className="text-xs text-[#6B7A8F] mt-0.5">
              Scrapes TikTok for viral hooks
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#1A1F2B] text-[#6B7A8F] hover:text-white hover:bg-[#252B39] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[60vh]">
          {!analysis && !isLoading && (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#2EE6C9]/20 to-[#0095FF]/20 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="url(#grad)" strokeWidth="1.5">
                  <defs>
                    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#2EE6C9" />
                      <stop offset="100%" stopColor="#0095FF" />
                    </linearGradient>
                  </defs>
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </div>
              <p className="text-white font-medium mb-2">
                "{query}"
              </p>
              <p className="text-sm text-[#6B7A8F] mb-6">
                Find what's working on TikTok right now
              </p>
              <button
                onClick={handleResearch}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#2EE6C9] to-[#0095FF] text-[#0B0E11] font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                Start Research
              </button>
            </div>
          )}

          {isLoading && (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-[#2EE6C9]/30 border-t-[#2EE6C9] animate-spin" />
              <p className="text-sm text-white mb-1">Scraping TikTok...</p>
              <p className="text-xs text-[#6B7A8F]">
                Analyzing trending content (30-60s)
              </p>
            </div>
          )}

          {error && (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              </div>
              <p className="text-red-400 text-sm mb-4">{error}</p>
              <button
                onClick={handleResearch}
                className="px-4 py-2 rounded-lg bg-[#1A1F2B] text-white text-sm hover:bg-[#252B39] transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {analysis && (
            <div className="space-y-5">
              {/* Stats Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2EE6C9]/10 text-[#2EE6C9] text-xs">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                {videosFound} videos analyzed
              </div>

              {/* Recommended Hooks */}
              <div>
                <h3 className="text-xs font-medium text-[#6B7A8F] uppercase tracking-wider mb-3">
                  Top Hooks
                </h3>
                <div className="space-y-2">
                  {analysis.recommended_hooks?.slice(0, 4).map((item, index) => (
                    <button
                      key={index}
                      onClick={() => onUseHook(item.hook)}
                      className="w-full text-left bg-[#1A1F2B] hover:bg-[#252B39] rounded-xl p-4 transition-colors group"
                    >
                      <p className="text-sm text-white mb-1.5 leading-relaxed">
                        "{item.hook}"
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-[#6B7A8F]">
                          {item.reasoning}
                        </p>
                        <span className="text-xs text-[#2EE6C9] opacity-0 group-hover:opacity-100 transition-opacity">
                          Use →
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hook Patterns */}
              {analysis.hook_patterns && analysis.hook_patterns.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-[#6B7A8F] uppercase tracking-wider mb-3">
                    Patterns
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {analysis.hook_patterns.slice(0, 4).map((pattern, index) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 rounded-full bg-[#1A1F2B] text-xs text-white"
                      >
                        {pattern.pattern}
                        <span className="ml-1.5 text-[#6B7A8F]">
                          {Math.round(pattern.frequency * 100)}%
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Content Insights */}
              {analysis.content_structure && (
                <div className="flex gap-3">
                  <div className="flex-1 bg-[#1A1F2B] rounded-xl p-3 text-center">
                    <p className="text-lg font-semibold text-white">
                      {analysis.content_structure.avg_duration_seconds}s
                    </p>
                    <p className="text-xs text-[#6B7A8F]">Avg Length</p>
                  </div>
                  <div className="flex-1 bg-[#1A1F2B] rounded-xl p-3 text-center">
                    <p className="text-lg font-semibold text-white">
                      {analysis.content_structure.common_formats?.[0] || "—"}
                    </p>
                    <p className="text-xs text-[#6B7A8F]">Top Format</p>
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
