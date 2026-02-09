"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import { ClipActions } from "@/components/ClipActions";
import type { Batch, Clip } from "@/lib/types";
import { cn, normalizeUIState } from "@/lib/utils";
import { ChevronLeft, Volume2, VolumeX, Film, Image, Download, Star, Trash2, Filter, X } from "lucide-react";
import Link from "next/link";

type LibraryTab = "studio" | "gallery";
type FilterType = "all" | "winners" | "killed";

interface BatchWithClips extends Batch {
  clips: Clip[];
}

function LibraryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Get initial tab from URL or default to studio
  const initialTab = (searchParams.get("tab") as LibraryTab) || "studio";
  
  const [activeTab, setActiveTab] = useState<LibraryTab>(initialTab);
  const [filter, setFilter] = useState<FilterType>("all");
  const [batches, setBatches] = useState<BatchWithClips[]>([]);
  const [allClips, setAllClips] = useState<Clip[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [viewMode, setViewMode] = useState<"feed" | "grid">("grid");
  const [showFilters, setShowFilters] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  const supabase = createClient();

  // Update URL when tab changes
  const handleTabChange = (tab: LibraryTab) => {
    setActiveTab(tab);
    setCurrentIndex(0);
    router.push(`/library?tab=${tab}`, { scroll: false });
  };

  // Get clips filtered by tab (videos vs images) and filter
  const feedClips = (() => {
    let clips = allClips;
    
    // Filter by content type
    if (activeTab === "studio") {
      clips = clips.filter((c) => c.final_url && !c.image_url);
    } else {
      clips = clips.filter((c) => c.image_url);
    }
    
    // Apply status filter
    if (filter === "winners") {
      clips = clips.filter((c) => c.winner);
    } else if (filter === "killed") {
      clips = clips.filter((c) => c.killed);
    }
    
    return clips.filter((c) => normalizeUIState(c.ui_state, c.status) === "ready");
  })();

  const currentClip = feedClips[currentIndex];
  
  // Count for tabs
  const videoCount = allClips.filter((c) => c.final_url && !c.image_url && normalizeUIState(c.ui_state, c.status) === "ready").length;
  const imageCount = allClips.filter((c) => c.image_url && normalizeUIState(c.ui_state, c.status) === "ready").length;

  // Clamp index when filter/tab changes
  useEffect(() => {
    setCurrentIndex((prev) => Math.min(prev, Math.max(0, feedClips.length - 1)));
  }, [activeTab, filter, feedClips.length]);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load all ready clips
        const { data: clipsData, error: clipsError } = await supabase
          .from("clips")
          .select("*")
          .or("ui_state.eq.ready,status.eq.ready")
          .order("created_at", { ascending: false })
          .limit(500);

        if (clipsError) throw clipsError;
        setAllClips((clipsData || []) as Clip[]);

        // Load batches for context
        const { data: batchesData } = await supabase
          .from("batches")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (batchesData) {
          setBatches(batchesData.map(b => ({ ...b, clips: [] })) as BatchWithClips[]);
        }
      } catch (err) {
        console.error("Error loading library:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Navigation
  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, feedClips.length - 1));
  }, [feedClips.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  // Swipe/wheel navigation for feed view
  useEffect(() => {
    if (viewMode !== "feed") return;
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY > 0) goToNext();
      else goToPrev();
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [goToNext, goToPrev, viewMode]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(deltaY) > 50) {
      if (deltaY > 0) goToNext();
      else goToPrev();
    }
  };

  // Auto-play video when clip changes
  useEffect(() => {
    if (videoRef.current && currentClip?.final_url) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [currentClip?.id]);

  // Default to sound on in feed view
  useEffect(() => {
    if (viewMode === "feed") setIsMuted(false);
  }, [viewMode]);

  // Actions
  const handleToggleWinner = useCallback(async (clipId?: string) => {
    const targetClip = clipId ? allClips.find(c => c.id === clipId) : currentClip;
    if (!targetClip || isUpdating) return;
    setIsUpdating(true);
    try {
      await supabase.from("clips").update({ winner: !targetClip.winner }).eq("id", targetClip.id);
      setAllClips((prev) =>
        prev.map((c) => (c.id === targetClip.id ? { ...c, winner: !c.winner } : c))
      );
    } finally {
      setIsUpdating(false);
    }
  }, [currentClip, allClips, isUpdating]);

  const handleToggleKilled = useCallback(async (clipId?: string) => {
    const targetClip = clipId ? allClips.find(c => c.id === clipId) : currentClip;
    if (!targetClip || isUpdating) return;
    setIsUpdating(true);
    try {
      await supabase.from("clips").update({ killed: !targetClip.killed }).eq("id", targetClip.id);
      setAllClips((prev) =>
        prev.map((c) => (c.id === targetClip.id ? { ...c, killed: !c.killed } : c))
      );
    } finally {
      setIsUpdating(false);
    }
  }, [currentClip, allClips, isUpdating]);

  const handleDownload = useCallback((clip?: Clip) => {
    const targetClip = clip || currentClip;
    const url = targetClip?.final_url || targetClip?.image_url;
    if (!url) return;
    
    const ext = targetClip?.image_url ? "png" : "mp4";
    const link = document.createElement("a");
    link.href = url;
    link.download = `${targetClip?.variant_id || "content"}.${ext}`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [currentClip]);

  // Loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0B0E11]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#2EE6C9]/30 border-t-[#2EE6C9] rounded-full animate-spin" />
          <p className="text-[#6B7A8F] text-sm">Loading your content...</p>
        </div>
      </div>
    );
  }

  // Note: We always show tabs now, even when empty

  return (
    <div className="min-h-screen bg-[#0B0E11]">
      {/* Header with tabs */}
      <header className="sticky top-0 z-40 bg-[#0B0E11]/95 backdrop-blur-lg border-b border-[#1C2230]">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-1 -ml-1 text-[#6B7A8F] hover:text-white">
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-2xl font-bold text-white tracking-tight">Library</h1>
          </div>
          
          {/* Filter icon */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="p-2.5 rounded-xl bg-[#12161D] text-[#6B7A8F] hover:text-white hover:bg-[#1C2230] transition-colors border border-[#1C2230]"
            aria-label="Filters"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
        
        {/* Tab bar */}
        <div className="px-4 pb-3">
          <div className="flex bg-[#12161D] rounded-2xl p-1.5 border border-[#1C2230]">
            <button
              onClick={() => handleTabChange("studio")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all",
                activeTab === "studio"
                  ? "bg-[#1C2230] text-white shadow-lg"
                  : "text-[#6B7A8F] hover:text-white"
              )}
            >
              <Film className="w-4 h-4" />
              <span>Studio</span>
              {videoCount > 0 && (
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-bold",
                  activeTab === "studio" ? "bg-[#2EE6C9] text-[#0B0E11]" : "bg-[#1C2230] text-[#6B7A8F]"
                )}>
                  {videoCount}
                </span>
              )}
            </button>
            <button
              onClick={() => handleTabChange("gallery")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all",
                activeTab === "gallery"
                  ? "bg-[#1C2230] text-white shadow-lg"
                  : "text-[#6B7A8F] hover:text-white"
              )}
            >
              <Image className="w-4 h-4" />
              <span>Gallery</span>
              {imageCount > 0 && (
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-bold",
                  activeTab === "gallery" ? "bg-[#A855F7] text-white" : "bg-[#1C2230] text-[#6B7A8F]"
                )}>
                  {imageCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filter dropdown */}
        {showFilters && (
          <div className="px-4 pb-3">
            <div className="flex gap-2">
              {(["all", "winners", "killed"] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setFilter(f);
                    setCurrentIndex(0);
                    setShowFilters(false);
                  }}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-medium transition-all border",
                    filter === f
                      ? f === "winners"
                        ? "bg-[#F59E0B]/20 border-[#F59E0B]/50 text-[#F59E0B]"
                        : f === "killed"
                          ? "bg-red-500/20 border-red-500/50 text-red-400"
                          : "bg-[#2EE6C9]/20 border-[#2EE6C9]/50 text-[#2EE6C9]"
                      : "bg-transparent border-[#1C2230] text-[#6B7A8F] hover:border-[#2A3441]"
                  )}
                >
                  {f === "all" && "All"}
                  {f === "winners" && "⭐ Winners"}
                  {f === "killed" && "🗑️ Killed"}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Empty state for current tab/filter */}
      {feedClips.length === 0 ? (
        <main className="flex flex-col items-center justify-center min-h-[50vh] px-4">
          <div className="w-20 h-20 rounded-2xl bg-[#12161D] border border-[#1C2230] flex items-center justify-center mb-6">
            <span className="text-4xl">
              {activeTab === "studio" ? "🎬" : "🖼️"}
            </span>
          </div>
          <p className="text-white font-semibold text-lg mb-2">
            {activeTab === "studio" ? "No videos yet" : "No images yet"}
          </p>
          <p className="text-[#6B7A8F] text-center text-sm mb-6 max-w-xs">
            {filter === "winners"
              ? `Mark your favorite ${activeTab === "studio" ? "videos" : "images"} as winners to see them here`
              : filter === "killed"
                ? `${activeTab === "studio" ? "Videos" : "Images"} you remove will appear here`
                : `Create ${activeTab === "studio" ? "videos" : "images"} on the Feed to see them here`}
          </p>
          <Link
            href="/"
            className={cn(
              "px-6 py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity",
              activeTab === "studio" 
                ? "bg-[#2EE6C9] text-[#0B0E11]" 
                : "bg-[#A855F7] text-white"
            )}
          >
            Create {activeTab === "studio" ? "Videos" : "Images"}
          </Link>
        </main>
      ) : viewMode === "grid" ? (
        /* Grid View */
        <main className="p-3 pb-24">
          <div className="grid grid-cols-3 gap-2">
            {feedClips.map((clip, index) => (
              <div
                key={clip.id}
                onClick={() => {
                  setCurrentIndex(index);
                  setViewMode("feed");
                }}
                className={cn(
                  "relative aspect-square rounded-xl overflow-hidden bg-[#0F131A]",
                  "border border-[#1E2634] cursor-pointer group",
                  "hover:border-[#2EE6C9]/60 hover:shadow-[0_0_0_1px_rgba(46,230,201,0.2),0_8px_30px_rgba(0,0,0,0.35)]",
                  "transition-all duration-200"
                )}
              >
                {clip.image_url ? (
                  <img
                    src={clip.image_url}
                    alt=""
                    className="w-full h-full object-cover object-[50%_20%] scale-[1.02] group-hover:scale-[1.04] transition-transform duration-300"
                    loading="lazy"
                    decoding="async"
                  />
                ) : clip.final_url ? (
                  <video
                    src={clip.final_url}
                    className="w-full h-full object-cover object-[50%_20%] scale-[1.02] group-hover:scale-[1.04] transition-transform duration-300"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : null}
                
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent opacity-80 pointer-events-none" />

                {/* Overlay badges */}
                <div className="absolute top-2 right-2 flex gap-1">
                  {clip.winner && (
                    <span className="w-7 h-7 rounded-full bg-[#F59E0B] flex items-center justify-center shadow-lg">
                      <Star className="w-3.5 h-3.5 text-white fill-white" />
                    </span>
                  )}
                </div>
                
                {/* Variant + provider labels */}
                <div className="absolute bottom-2 left-2 flex gap-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-black/70 text-white text-[11px] font-bold tracking-wide">
                    {clip.variant_id}
                  </span>
                  {(clip.provider || clip.video_service) && (
                    <span className="px-2.5 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-extrabold uppercase tracking-wider">
                      {(clip.provider || clip.video_service) === "kling" ? "Kling" : "Sora"}
                    </span>
                  )}
                </div>
                
                {/* Video icon */}
                {clip.final_url && !clip.image_url && (
                  <div className="absolute bottom-2 right-2">
                    <Film className="w-4.5 h-4.5 text-white/90 drop-shadow" />
                  </div>
                )}

                {/* Hover hint */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="absolute bottom-3 right-3 text-[10px] font-bold uppercase tracking-wider text-white/90">
                    Tap to view
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      ) : (
        /* Feed View - Full screen swipeable */
        <div
          ref={containerRef}
          className="fixed inset-0 bg-black z-30"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Exit controls */}
          <div className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between">
            <button
              onClick={() => setViewMode("grid")}
              className="flex items-center gap-2 px-3 py-2 rounded-full bg-black/50 text-white text-sm font-semibold"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Full-screen content */}
          <div className="w-full h-full flex items-center justify-center">
            {currentClip?.image_url ? (
              <img
                src={currentClip.image_url}
                alt=""
                className="w-full h-full object-contain"
              />
            ) : currentClip?.final_url ? (
              <video
                ref={videoRef}
                src={currentClip.final_url}
                className="w-full h-full object-contain"
                autoPlay
                loop
                playsInline
                muted={isMuted}
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
                  }
                }}
              />
            ) : (
              <div className="w-full h-full bg-[#11151C] flex items-center justify-center text-[#6B7A8F]">
                No media
              </div>
            )}
          </div>

          {/* Right side actions */}
          <div className="absolute right-4 bottom-32 z-40 flex flex-col gap-4 items-center">
            {/* Mute toggle (video only) */}
            {activeTab === "studio" && (
              <button
                onClick={() => setIsMuted((m) => !m)}
                className="w-12 h-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            )}
            
            {/* Winner toggle */}
            <button
              onClick={() => handleToggleWinner()}
              disabled={isUpdating}
              className={cn(
                "w-12 h-12 rounded-full backdrop-blur flex items-center justify-center transition-colors",
                currentClip?.winner
                  ? "bg-[#F59E0B] text-white"
                  : "bg-white/10 text-white hover:bg-white/20"
              )}
            >
              <Star className={cn("w-5 h-5", currentClip?.winner && "fill-white")} />
            </button>
            
            {/* Kill toggle */}
            <button
              onClick={() => handleToggleKilled()}
              disabled={isUpdating}
              className={cn(
                "w-12 h-12 rounded-full backdrop-blur flex items-center justify-center transition-colors",
                currentClip?.killed
                  ? "bg-red-500 text-white"
                  : "bg-white/10 text-white hover:bg-white/20"
              )}
            >
              <Trash2 className="w-5 h-5" />
            </button>
            
            {/* Download */}
            <button
              onClick={() => handleDownload()}
              className="w-12 h-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom info */}
          <div className="absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black/90 to-transparent px-4 pb-8 pt-16">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-block px-2 py-0.5 rounded bg-[#2EE6C9]/20 text-[#2EE6C9] text-xs font-medium">
                    {currentClip?.variant_id}
                  </span>
                  {currentClip?.winner && (
                    <span className="inline-block px-2 py-0.5 rounded bg-[#F59E0B]/20 text-[#F59E0B] text-xs font-medium">
                      ⭐ Winner
                    </span>
                  )}
                </div>
                <p className="text-white text-sm font-medium line-clamp-2">
                  {batches.find((b) => b.id === currentClip?.batch_id)?.intent_text || "Your content"}
                </p>
              </div>
              <span className="flex-shrink-0 text-white/60 text-xs font-medium">
                {currentIndex + 1} / {feedClips.length}
              </span>
            </div>
          </div>

          {/* Swipe hint */}
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 pointer-events-none z-0 opacity-20">
            <p className="text-white/40 text-xs uppercase tracking-widest">↑ Swipe ↓</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center bg-[#0B0E11]">
        <div className="w-8 h-8 border-2 border-[#2EE6C9]/30 border-t-[#2EE6C9] rounded-full animate-spin" />
      </div>
    }>
      <LibraryContent />
    </Suspense>
  );
}
