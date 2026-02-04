"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { ClipActions } from "@/components/ClipActions";
import type { Batch, Clip } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChevronLeft, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";

type FilterType = "winners" | "all" | "batches";

interface BatchWithClips extends Batch {
  clips: Clip[];
}

export default function LibraryPage() {
  const [filter, setFilter] = useState<FilterType>("winners");
  const [batches, setBatches] = useState<BatchWithClips[]>([]);
  const [allClips, setAllClips] = useState<Clip[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  const supabase = createClient();

  // Get clips for current filter
  const feedClips = (() => {
    if (filter === "winners") {
      return allClips.filter((c) => c.winner && c.status === "ready");
    }
    if (filter === "batches") {
      return batches.flatMap((b) => b.clips).filter((c) => c.status === "ready");
    }
    return allClips.filter((c) => c.status === "ready");
  })();

  const currentClip = feedClips[currentIndex];

  // Clamp index when filter changes and current is out of bounds
  useEffect(() => {
    setCurrentIndex((prev) => Math.min(prev, Math.max(0, feedClips.length - 1)));
  }, [filter]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const { data: batchesData, error: batchesError } = await supabase
          .from("batches")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);

        if (batchesError) throw batchesError;

        const batchesWithClips: BatchWithClips[] = [];
        for (const batch of batchesData || []) {
          const { data: clipsData } = await supabase
            .from("clips")
            .select("*")
            .eq("batch_id", batch.id)
            .order("variant_id");

          batchesWithClips.push({
            ...batch,
            clips: (clipsData || []) as Clip[],
          });
        }
        setBatches(batchesWithClips);

        const { data: clipsData } = await supabase
          .from("clips")
          .select("*")
          .eq("status", "ready")
          .order("created_at", { ascending: false })
          .limit(200);

        setAllClips((clipsData || []) as Clip[]);
      } catch (err) {
        console.error("Error loading library:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, feedClips.length - 1));
  }, [feedClips.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  // Swipe / wheel navigation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY > 0) goToNext();
      else goToPrev();
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [goToNext, goToPrev]);

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

  useEffect(() => {
    if (videoRef.current && currentClip?.final_url) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [currentClip?.id]);

  const handleToggleWinner = useCallback(async () => {
    if (!currentClip || isUpdating) return;
    setIsUpdating(true);
    try {
      await supabase.from("clips").update({ winner: !currentClip.winner }).eq("id", currentClip.id);
      setAllClips((prev) =>
        prev.map((c) => (c.id === currentClip.id ? { ...c, winner: !c.winner } : c))
      );
    } finally {
      setIsUpdating(false);
    }
  }, [currentClip, isUpdating]);

  const handleToggleKilled = useCallback(async () => {
    if (!currentClip || isUpdating) return;
    setIsUpdating(true);
    try {
      await supabase.from("clips").update({ killed: !currentClip.killed }).eq("id", currentClip.id);
      setAllClips((prev) =>
        prev.map((c) => (c.id === currentClip.id ? { ...c, killed: !c.killed } : c))
      );
    } finally {
      setIsUpdating(false);
    }
  }, [currentClip, isUpdating]);

  const handleDownload = useCallback(() => {
    if (!currentClip?.final_url) return;
    const link = document.createElement("a");
    link.href = currentClip.final_url;
    link.download = `${currentClip.variant_id}.mp4`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [currentClip]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0B0E11]">
        <div className="w-1.5 h-1.5 rounded-full bg-[#2EE6C9] animate-pulse" />
      </div>
    );
  }

  if (feedClips.length === 0) {
    return (
      <>
        <header className="sticky top-0 z-40 bg-[#0B0E11]/95 backdrop-blur-lg border-b border-[#1C2230] px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-1 -ml-1 text-[#6B7A8F] hover:text-white">
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-lg font-semibold text-white">Library</h1>
          </div>
        </header>
        <main className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <p className="text-[#6B7A8F] text-center text-sm">
            {filter === "winners"
              ? "No winners yet. Generate clips and mark favorites!"
              : "No clips yet. Create something on the Feed!"}
          </p>
          <Link
            href="/"
            className="mt-4 px-6 py-3 rounded-xl bg-[#2EE6C9] text-[#0B0E11] font-semibold text-sm"
          >
            Go to Feed
          </Link>
        </main>
      </>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black z-0 flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Minimal header with filters */}
      <header className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent pt-12 px-4 pb-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="p-2 -ml-2 text-white/90 hover:text-white">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div className="flex gap-1 rounded-full bg-white/10 p-1">
            {(["winners", "all", "batches"] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f);
                  setCurrentIndex(0);
                }}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider transition-all",
                  filter === f ? "bg-white text-black" : "text-white/80 hover:text-white"
                )}
              >
                {f === "winners" && "🏆"}
                {f === "all" && "All"}
                {f === "batches" && "📦"}
              </button>
            ))}
          </div>
          <div className="w-10" />
        </div>
      </header>

      {/* Full-screen video - TikTok style */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        {currentClip?.final_url || currentClip?.image_url ? (
          currentClip.image_url ? (
            <img
              src={currentClip.image_url}
              alt=""
              className="w-full h-full object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              src={currentClip?.final_url || ""}
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
          )
        ) : (
          <div className="w-full h-full bg-[#11151C] flex items-center justify-center text-[#6B7A8F]">
            No media
          </div>
        )}
      </div>

      {/* Right side actions - TikTok style */}
      <div className="absolute right-3 bottom-24 z-20 flex flex-col gap-5 items-center">
        <button
          onClick={() => setIsMuted((m) => !m)}
          className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
        <ClipActions
          isWinner={currentClip?.winner ?? false}
          isKilled={currentClip?.killed ?? false}
          onToggleWinner={handleToggleWinner}
          onToggleKilled={handleToggleKilled}
          onDownload={handleDownload}
          disabled={isUpdating}
        />
      </div>

      {/* Bottom info - TikTok style */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 to-transparent px-4 pb-8 pt-16">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <span className="inline-block px-2 py-0.5 rounded bg-[#2EE6C9]/20 text-[#2EE6C9] text-xs font-medium uppercase tracking-wider mb-1">
              {currentClip?.variant_id}
            </span>
            <p className="text-white text-sm font-medium line-clamp-2">
              {batches.find((b) => b.id === currentClip?.batch_id)?.intent_text ||
                "Your clip"}
            </p>
          </div>
          <span className="flex-shrink-0 text-white/60 text-xs font-medium">
            {currentIndex + 1} / {feedClips.length}
          </span>
        </div>
      </div>

      {/* Swipe hint */}
      <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 pointer-events-none z-0 opacity-0">
        <p className="text-white/40 text-xs uppercase tracking-widest">Swipe</p>
      </div>
    </div>
  );
}
