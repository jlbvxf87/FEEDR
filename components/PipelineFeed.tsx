"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { cn, normalizeUIState } from "@/lib/utils";
import type { Clip, Batch } from "@/lib/types";
import { AlertTriangle, CheckCircle2, Film, GitMerge, Mic2, PenLine, Search, Sparkles } from "lucide-react";

interface PipelineFeedProps {
  clips: Clip[];
  batch: Batch;
}

interface FeedMessage {
  id: string;
  phase: "input" | "research" | "script" | "voice" | "video" | "assembly" | "complete" | "error";
  title: string;
  message: string;
  highlight?: string;
  variant?: string;
  isActive?: boolean;
  confidence?: number; // 0-100 for confidence indicators
}

// Smart, conversational messages that build excitement
const PHASE_INTROS: Record<string, string[]> = {
  research: [
    "Let me find what's actually working right now...",
    "Scanning TikTok for viral patterns in your niche...",
    "Looking for content that's crushing it...",
  ],
  script: [
    "Now I'm writing hooks based on what actually converts...",
    "Crafting scripts using those winning patterns...",
    "Building your variants with proven formulas...",
  ],
  voice: [
    "Bringing your script to life with natural voice...",
    "Recording the voiceover now...",
    "Adding that authentic sound...",
  ],
  video: [
    "Creating the visuals to match your script...",
    "Generating your video with Sora...",
    "This is where the magic happens...",
  ],
  assembly: [
    "Putting it all together now...",
    "Final touches being added...",
    "Almost ready for you to use...",
  ],
};

// Calculate current phase from clips state
function getCurrentPhase(clips: Clip[], batchStatus: string): string {
  if (batchStatus === "researching") return "research";
  if (clips.length === 0) return "input";
  
  const statuses = clips.map(c => normalizeUIState(c.ui_state, c.status));
  
  if (statuses.every(s => s === "ready")) return "complete";
  if (statuses.some(s => s === "assembling")) return "assembly";
  if (statuses.some(s => s === "rendering" || s === "rendering_delayed" || s === "submitting")) return "video";
  if (statuses.some(s => s === "voicing")) return "voice";
  if (statuses.some(s => s === "writing")) return "script";
  if (statuses.some(s => s === "queued")) return "input";
  
  return "research";
}

// Parse raw error strings into user-friendly messages with step context
interface ParsedError {
  step: string;
  userMessage: string;
  guidance: string;
}

function parseClipError(rawError: string | null): ParsedError {
  if (!rawError) {
    return { step: "unknown", userMessage: "Something went wrong", guidance: "We'll retry automatically" };
  }

  const lower = rawError.toLowerCase();

  // Video-specific errors
  if (lower.includes("video generation timed out") || (lower.includes("sora task") && lower.includes("never completed"))) {
    return { step: "video", userMessage: "Video creation took too long", guidance: "This sometimes happens with complex scenes. Try simplifying your prompt." };
  }
  if ((lower.includes("sora") && lower.includes("failed")) || lower.includes("video") && lower.includes("failed")) {
    return { step: "video", userMessage: "AI couldn't create this video", guidance: "Try adjusting your prompt for simpler visuals." };
  }
  if (lower.includes("no video prompt")) {
    return { step: "video", userMessage: "Not enough detail for video generation", guidance: "Try a more descriptive prompt." };
  }

  // Voice errors
  if (lower.includes("voice") || lower.includes("tts") || lower.includes("audio")) {
    return { step: "voice", userMessage: "Voice generation failed", guidance: "This is usually temporary. Try again in a moment." };
  }

  // Script errors
  if (lower.includes("script") || lower.includes("compile")) {
    return { step: "script", userMessage: "Script generation failed", guidance: "Try rewording your prompt." };
  }

  // Assembly errors
  if (lower.includes("assembl") || lower.includes("merge") || lower.includes("overlay")) {
    return { step: "assembly", userMessage: "Final assembly failed", guidance: "This is usually a temporary issue. Try again." };
  }

  // Content policy
  if (lower.includes("content policy") || lower.includes("safety") || lower.includes("violat")) {
    return { step: "unknown", userMessage: "Content flagged by safety filter", guidance: "Modify your prompt to avoid restricted content." };
  }

  // Max retries
  if (lower.includes("max retries")) {
    return { step: "unknown", userMessage: "Failed after 3 attempts", guidance: "This usually means a temporary service issue. Try again later." };
  }

  // Cancelled
  if (lower.includes("cancelled by user")) {
    return { step: "unknown", userMessage: "Cancelled by you", guidance: "Credits have been refunded." };
  }

  // Default
  return {
    step: "unknown",
    userMessage: rawError.length > 80 ? rawError.slice(0, 80) + "..." : rawError,
    guidance: "Try again or adjust your prompt.",
  };
}

// Generate smart, conversational feed messages
function generateMessages(
  clips: Clip[], 
  batch: Batch
): FeedMessage[] {
  const messages: FeedMessage[] = [];
  const research = batch.research_json;
  const currentPhase = getCurrentPhase(clips, batch.status);
  const providers = clips
    .map((c) => (c.provider || c.video_service || "").toLowerCase())
    .filter(Boolean);
  const useNativeAudio =
    providers.length > 0 && providers.every((p) => p === "sora");
  let msgId = 0;

  // ═══════════════════════════════════════════════════════════════
  // PHASE 1: INPUT - Acknowledge the user's request
  // ═══════════════════════════════════════════════════════════════
  messages.push({
    id: `msg-${msgId++}`,
    phase: "input",
    title: "Got it!",
    message: `Creating ${batch.batch_size} variations for you`,
    highlight: `"${batch.intent_text.slice(0, 50)}${batch.intent_text.length > 50 ? '...' : ''}"`,
  });

  // ═══════════════════════════════════════════════════════════════
  // PHASE 2: RESEARCH - Show the brain working
  // ═══════════════════════════════════════════════════════════════
  const isResearchActive = batch.status === "researching";
  const hasResearch = !!research?.scraped_videos?.length;

  if (isResearchActive || hasResearch) {
    // Category detection
    if (research?.category) {
      messages.push({
        id: `msg-${msgId++}`,
        phase: "research",
        title: "Found your niche",
        message: `Detected "${research.category.replace(/_/g, ' ')}" content`,
        highlight: research.category_info?.description,
        isActive: isResearchActive && !research?.search_query,
      });
    }

    // Brain query generation
    if (research?.search_query || isResearchActive) {
      messages.push({
        id: `msg-${msgId++}`,
        phase: "research",
        title: isResearchActive && !hasResearch ? "Brain is thinking..." : "Smart search generated",
        message: research?.search_query 
          ? `Searching for: "${research.search_query}"`
          : "Analyzing your topic to find the best examples...",
        isActive: isResearchActive && !hasResearch,
      });
    }

    // Scraping results - this is exciting!
    if (research?.scraped_videos?.length) {
      const avgViews = research.scraped_videos.reduce((s, v) => s + (v.views || 0), 0) / research.scraped_videos.length;
      const totalViews = research.scraped_videos.reduce((s, v) => s + (v.views || 0), 0);
      
      messages.push({
        id: `msg-${msgId++}`,
        phase: "research",
        title: "Found viral gold!",
        message: `${research.scraped_videos.length} proven winners analyzed`,
        highlight: `${Math.round(avgViews).toLocaleString()} avg views per video`,
        confidence: 85,
      });

      // Show top hook found - builds confidence
      const topVideo = research.scraped_videos[0];
      const topHook = topVideo?.hook_text || topVideo?.caption;
      if (topHook) {
        messages.push({
          id: `msg-${msgId++}`,
          phase: "research",
          title: "Top performing hook",
          message: `This exact style got ${topVideo.views?.toLocaleString() || 'massive'} views`,
          highlight: `"${topHook.slice(0, 60)}${topHook.length > 60 ? '...' : ''}"`,
        });
      }
    }

    // Pattern analysis
    if (research?.trend_analysis?.hook_patterns?.length) {
      const patterns = research.trend_analysis.hook_patterns;
      const topPattern = patterns[0];
      
      messages.push({
        id: `msg-${msgId++}`,
        phase: "research",
        title: "Patterns decoded",
        message: `Found ${patterns.length} winning formulas`,
        highlight: `#1 Pattern: "${topPattern.pattern}" (${Math.round(topPattern.frequency * 100)}% of viral hits)`,
        confidence: 90,
      });
    }

    // Engagement drivers
    if (research?.trend_analysis?.engagement_drivers?.length) {
      const drivers = research.trend_analysis.engagement_drivers.slice(0, 3);
      messages.push({
        id: `msg-${msgId++}`,
        phase: "research",
        title: "Why these work",
        message: `Key drivers: ${drivers.join(", ")}`,
        highlight: "Your content will use these same triggers",
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 3: SCRIPT - Show scripts being written
  // ═══════════════════════════════════════════════════════════════
  const scriptingClips = clips.filter(c => normalizeUIState(c.ui_state, c.status) === "writing");
  const hasScripts = clips.some(c => c.script_spoken);

  if (scriptingClips.length > 0 || hasScripts) {
    // Script phase intro
    if (currentPhase === "script" && !hasScripts) {
      messages.push({
        id: `msg-${msgId++}`,
        phase: "script",
        title: "Writing your scripts",
        message: "Using those winning patterns to craft unique hooks...",
        isActive: true,
      });
    }

    // Show each script as it's generated
    clips.forEach((clip, index) => {
      const variantLabel = clip.variant_id || `V${String(index + 1).padStart(2, '0')}`;
      
      if (normalizeUIState(clip.ui_state, clip.status) === "writing") {
        messages.push({
          id: `msg-${msgId++}`,
          phase: "script",
          title: `Writing ${variantLabel}`,
          message: "Crafting a unique hook angle...",
          variant: variantLabel,
          isActive: true,
        });
      } else if (clip.script_spoken) {
        const hookPreview = clip.script_spoken.split(/[.!?]/)[0]?.trim() || clip.script_spoken.slice(0, 60);
        messages.push({
          id: `msg-${msgId++}`,
          phase: "script",
          title: `${variantLabel} script ready`,
          message: "Based on proven viral patterns",
          highlight: `"${hookPreview}${hookPreview.length < clip.script_spoken.length ? '...' : ''}"`,
          variant: variantLabel,
          confidence: 88,
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 4: VOICE - Recording voiceovers
  // ═══════════════════════════════════════════════════════════════
  const voClips = clips.filter(c => normalizeUIState(c.ui_state, c.status) === "voicing");
  const hasVoice = clips.some(c => c.voice_url);

  if (useNativeAudio) {
    messages.push({
      id: `msg-${msgId++}`,
      phase: "voice",
      title: "Sora native audio",
      message: "Voice is embedded in the render",
      variant: "All",
    });
  } else if (voClips.length > 0 || hasVoice) {
    clips.forEach((clip, index) => {
      const variantLabel = clip.variant_id || `V${String(index + 1).padStart(2, '0')}`;

      // Show "recording" only if status is "vo" AND no voice_url yet
      // (with parallel pipeline, status may still be "vo" after voice is done)
      if (normalizeUIState(clip.ui_state, clip.status) === "voicing" && !clip.voice_url) {
        messages.push({
          id: `msg-${msgId++}`,
          phase: "voice",
          title: `Recording ${variantLabel}`,
          message: "Adding natural, engaging voice...",
          variant: variantLabel,
          isActive: true,
        });
      } else if (clip.voice_url) {
        messages.push({
          id: `msg-${msgId++}`,
          phase: "voice",
          title: `${variantLabel} voice done`,
          message: "Audio sounds authentic and engaging",
          variant: variantLabel,
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 5: VIDEO - Rendering visuals
  // ═══════════════════════════════════════════════════════════════
  const renderingClips = clips.filter(c => {
    const s = normalizeUIState(c.ui_state, c.status);
    return s === "rendering" || s === "rendering_delayed" || s === "submitting";
  });
  const hasVideo = clips.some(c => c.raw_video_url || c.final_url);

  if (renderingClips.length > 0 || hasVideo) {
    clips.forEach((clip, index) => {
      const variantLabel = clip.variant_id || `V${String(index + 1).padStart(2, '0')}`;

      // Show "done" when raw_video_url is present, regardless of status
      if (clip.raw_video_url) {
        messages.push({
          id: `msg-${msgId++}`,
          phase: "video",
          title: `${variantLabel} video rendered`,
          message: "Visual content created successfully",
          variant: variantLabel,
        });
      } else if (normalizeUIState(clip.ui_state, clip.status) === "rendering") {
        messages.push({
          id: `msg-${msgId++}`,
          phase: "video",
          title: `Rendering ${variantLabel}`,
          message: "Sora is creating your visuals...",
          highlight: "This takes about 3-5 minutes",
          variant: variantLabel,
          isActive: true,
        });
      } else if (normalizeUIState(clip.ui_state, clip.status) === "rendering_delayed") {
        messages.push({
          id: `rendering-delayed-${clip.id}`,
          phase: "video",
          title: "Still rendering",
          message: clip.ui_message || "High demand — still rendering. We’ll keep checking automatically.",
          variant: clip.variant_id,
          isActive: true,
          confidence: 60,
        });
      } else if (normalizeUIState(clip.ui_state, clip.status) === "submitting") {
        messages.push({
          id: `submitting-${clip.id}`,
          phase: "video",
          title: "Submitting to provider",
          message: "Starting the video render now...",
          variant: clip.variant_id,
          isActive: true,
          confidence: 70,
        });
        messages.push({
          id: `msg-${msgId++}`,
          phase: "video",
          title: `Generating ${variantLabel}`,
          message: "Creating your image with AI...",
          highlight: "This takes about 10-20 seconds",
          variant: variantLabel,
          isActive: true,
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 6: ASSEMBLY - Final merge
  // ═══════════════════════════════════════════════════════════════
  const assemblingClips = clips.filter(c => normalizeUIState(c.ui_state, c.status) === "assembling");
  const readyClips = clips.filter(c => normalizeUIState(c.ui_state, c.status) === "ready");

  if (assemblingClips.length > 0 || readyClips.length > 0) {
    clips.forEach((clip, index) => {
      const variantLabel = clip.variant_id || `V${String(index + 1).padStart(2, '0')}`;
      
      if (normalizeUIState(clip.ui_state, clip.status) === "assembling") {
        messages.push({
          id: `msg-${msgId++}`,
          phase: "assembly",
          title: `Assembling ${variantLabel}`,
          message: "Merging audio, video, and text overlays...",
          variant: variantLabel,
          isActive: true,
        });
      } else if (normalizeUIState(clip.ui_state, clip.status) === "ready" && clip.final_url) {
        messages.push({
          id: `msg-${msgId++}`,
          phase: "complete",
          title: `${variantLabel} is ready!`,
          message: "Ready to post - built from proven viral patterns",
          variant: variantLabel,
          confidence: 92,
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // COMPLETION MESSAGE - Celebrate!
  // ═══════════════════════════════════════════════════════════════
  if (readyClips.length === clips.length && clips.length > 0) {
    messages.push({
      id: `msg-${msgId++}`,
      phase: "complete",
      title: "All done!",
      message: `${clips.length} unique variations ready to post`,
      highlight: "Each one uses hooks proven to get views. Pick your favorite and go viral!",
      confidence: 95,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // ERROR HANDLING - Enhanced with step context and guidance
  // ═══════════════════════════════════════════════════════════════
  const failedClips = clips.filter(c => {
    const s = normalizeUIState(c.ui_state, c.status);
    return s === "failed_not_charged" || s === "failed_charged" || s === "failed";
  });
  failedClips.forEach((clip, index) => {
    const variantLabel = clip.variant_id || `V${String(index + 1).padStart(2, '0')}`;
    const uiState = normalizeUIState(clip.ui_state, clip.status);
    const parsed = parseClipError(clip.ui_message || clip.error);
    const chargeLine =
      uiState === "failed_not_charged"
        ? "No charges were applied for this failed render."
        : uiState === "failed_charged"
          ? "This render may have been charged by the provider."
          : "";
    messages.push({
      id: `msg-${msgId++}`,
      phase: "error",
      title: `${variantLabel} failed${parsed.step !== "unknown" ? ` at ${parsed.step}` : ""}`,
      message: parsed.userMessage,
      highlight: [parsed.guidance, chargeLine].filter(Boolean).join(" "),
      variant: variantLabel,
    });
  });

  return messages;
}

// Phase colors
const PHASE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  input: { text: "text-[#6B7A8F]", bg: "bg-[#6B7A8F]/10", border: "border-[#6B7A8F]/20" },
  research: { text: "text-[#A855F7]", bg: "bg-[#A855F7]/10", border: "border-[#A855F7]/30" },
  script: { text: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10", border: "border-[#F59E0B]/30" },
  voice: { text: "text-[#EC4899]", bg: "bg-[#EC4899]/10", border: "border-[#EC4899]/30" },
  video: { text: "text-[#0095FF]", bg: "bg-[#0095FF]/10", border: "border-[#0095FF]/30" },
  assembly: { text: "text-[#2EE6C9]", bg: "bg-[#2EE6C9]/10", border: "border-[#2EE6C9]/30" },
  complete: { text: "text-[#22C55E]", bg: "bg-[#22C55E]/10", border: "border-[#22C55E]/30" },
  error: { text: "text-[#EF4444]", bg: "bg-[#EF4444]/10", border: "border-[#EF4444]/30" },
};

const PHASE_ICONS: Record<FeedMessage["phase"], React.ReactNode> = {
  input: <Sparkles className="w-4 h-4 text-white/80" />,
  research: <Search className="w-4 h-4 text-white/80" />,
  script: <PenLine className="w-4 h-4 text-white/80" />,
  voice: <Mic2 className="w-4 h-4 text-white/80" />,
  video: <Film className="w-4 h-4 text-white/80" />,
  assembly: <GitMerge className="w-4 h-4 text-white/80" />,
  complete: <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />,
  error: <AlertTriangle className="w-4 h-4 text-[#EF4444]" />,
};

export function PipelineFeed({ clips, batch }: PipelineFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  
  const allMessages = useMemo(() => generateMessages(clips, batch), [clips, batch]);
  const visibleMessages = allMessages.slice(0, visibleCount);
  const allDone = clips.length > 0 && clips.every(c => normalizeUIState(c.ui_state, c.status) === "ready");
  const currentPhase = getCurrentPhase(clips, batch.status);

  // Animate messages appearing
  useEffect(() => {
    if (allDone) {
      setVisibleCount(allMessages.length);
      return;
    }

    if (visibleCount < allMessages.length) {
      const timer = setTimeout(() => {
        setVisibleCount(prev => Math.min(prev + 1, allMessages.length));
      }, visibleCount === 0 ? 100 : 600);
      return () => clearTimeout(timer);
    }
  }, [allMessages.length, visibleCount, allDone]);

  // Auto-scroll
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTo({
        top: feedRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [visibleCount]);

  if (allMessages.length === 0) return null;

  return (
    <div className="border-t border-[#1C2230]">
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between bg-gradient-to-r from-[#0F1318] to-[#0B0E11]">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "w-2.5 h-2.5 rounded-full",
            allDone 
              ? "bg-[#22C55E] shadow-[0_0_8px_#22C55E]" 
              : "bg-[#0095FF] shadow-[0_0_8px_#0095FF] animate-pulse"
          )} />
          <span className="text-xs font-medium text-white/80">
            {allDone ? "Complete" : "Processing..."}
          </span>
        </div>
        
        {/* Progress indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {["research", "script", "voice", "video", "assembly"].map((phase, i) => (
              <div
                key={phase}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-300",
                  currentPhase === phase && "w-3 bg-[#0095FF] shadow-[0_0_6px_#0095FF]",
                  ["research", "script", "voice", "video", "assembly"].indexOf(currentPhase) > i && "bg-[#22C55E]",
                  ["research", "script", "voice", "video", "assembly"].indexOf(currentPhase) < i && "bg-[#2A3241]",
                  currentPhase === phase && "bg-[#0095FF]"
                )}
              />
            ))}
          </div>
          <span className="text-[10px] font-mono text-[#4B5563]">
            {clips.filter(c => normalizeUIState(c.ui_state, c.status) === "ready").length}/{clips.length}
          </span>
        </div>
      </div>

      {/* Feed content */}
      <div 
        ref={feedRef}
        className="h-56 overflow-y-auto bg-[#0A0D10] p-4 space-y-3"
      >
        {visibleMessages.map((msg, index) => {
          const colors = PHASE_COLORS[msg.phase];
          const isLatest = index === visibleMessages.length - 1 && !allDone;
          
          return (
            <div 
              key={msg.id}
              className={cn(
                "relative rounded-xl p-3 border transition-all duration-500",
                "animate-in fade-in slide-in-from-bottom-3",
                colors.bg,
                colors.border,
                isLatest && "ring-1 ring-[#0095FF]/50"
              )}
              style={{ animationDuration: "400ms" }}
            >
              {/* Active indicator */}
              {msg.isActive && (
                <div className="absolute top-3 right-3">
                  <div className="w-2 h-2 rounded-full bg-[#0095FF] animate-pulse shadow-[0_0_8px_#0095FF]" />
                </div>
              )}

              {/* Header row */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{PHASE_ICONS[msg.phase]}</span>
                <span className={cn("font-semibold text-sm", colors.text)}>
                  {msg.title}
                </span>
                {msg.variant && (
                  <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] font-mono text-[#6B7A8F]">
                    {msg.variant}
                  </span>
                )}
                {msg.confidence && (
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-[#22C55E]/20 text-[10px] font-medium text-[#22C55E]">
                    {msg.confidence}% match
                  </span>
                )}
              </div>

              {/* Message */}
              <p className="text-xs text-[#9CA3AF] leading-relaxed pl-6">
                {msg.message}
              </p>

              {/* Highlight (quoted content, stats, etc.) */}
              {msg.highlight && (
                <div className="mt-2 ml-6 pl-3 border-l-2 border-white/10">
                  <p className="text-xs text-white/70 italic leading-relaxed">
                    {msg.highlight}
                  </p>
                </div>
              )}

              {/* Typing indicator for active items */}
              {msg.isActive && (
                <div className="mt-2 ml-6 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0095FF] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0095FF] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0095FF] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}
            </div>
          );
        })}

        {/* Completion celebration */}
        {allDone && (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#22C55E]/20 to-[#2EE6C9]/20 border border-[#22C55E]/30">
              <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
              <span className="text-sm font-medium text-[#22C55E]">
                Your content is ready to go viral!
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
