"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Clip } from "@/lib/types";
import { Play, Star, X } from "lucide-react";

interface ResultsGridProps {
  clips: Clip[];
  onClipClick: (index: number) => void;
  isLoading?: boolean;
  /** Only show this many slots (batch_size) - no extra empty rows */
  batchSize?: number;
}

function ClipTile({
  clip,
  onClick,
  isNew,
}: {
  clip: Clip;
  index: number;
  onClick: () => void;
  isNew?: boolean;
}) {
  const [isHovering, setIsHovering] = useState(false);
  const [showWinnerPulse, setShowWinnerPulse] = useState(false);
  const [showKillFlash, setShowKillFlash] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const prevWinnerRef = useRef(clip.winner);
  const prevKilledRef = useRef(clip.killed);

  const isReady = clip.status === "ready";
  const hasFinalUrl = !!clip.final_url;

  // Trigger animations on winner/kill change
  useEffect(() => {
    if (clip.winner && !prevWinnerRef.current) {
      setShowWinnerPulse(true);
      setTimeout(() => setShowWinnerPulse(false), 400);
    }
    prevWinnerRef.current = clip.winner;
  }, [clip.winner]);

  useEffect(() => {
    if (clip.killed && !prevKilledRef.current) {
      setShowKillFlash(true);
      setTimeout(() => setShowKillFlash(false), 300);
    }
    prevKilledRef.current = clip.killed;
  }, [clip.killed]);

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (hasFinalUrl && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      disabled={!isReady}
      className={cn(
        "relative aspect-[9/16] rounded-xl overflow-hidden",
        "bg-[var(--feedr-surface)] border border-[var(--feedr-border)]",
        "transition-all duration-200",
        "focus:outline-none",
        isReady && "hover:scale-[1.02] hover:border-[var(--feedr-teal)]/20 cursor-pointer",
        !isReady && "cursor-default",
        isNew && "animate-clip-arrive",
        showWinnerPulse && "animate-winner-pulse",
        clip.killed && "opacity-60 grayscale-[30%]"
      )}
    >
      {/* Video preview */}
      {hasFinalUrl && (
        <video
          ref={videoRef}
          src={clip.final_url!}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          loop
          playsInline
          preload="metadata"
        />
      )}

      {/* Manufacturing state */}
      {!isReady && (
        <div className="absolute inset-0 shimmer" />
      )}

      {/* Status indicator */}
      {!isReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-xs text-[var(--feedr-text-muted)] font-medium uppercase tracking-wider">
            {clip.variant_id}
          </div>
          <div className="text-xs text-[var(--feedr-text-disabled)] mt-1 capitalize">
            {clip.status === "planned" ? "Queued" : 
             clip.status === "scripting" ? "Writing" : 
             clip.status === "vo" ? "Voice" : 
             clip.status === "rendering" ? "Rendering" : 
             clip.status === "assembling" ? "Assembling" : 
             clip.status}
          </div>
        </div>
      )}

      {/* Play indicator on hover */}
      {isReady && isHovering && !clip.killed && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center transition-opacity duration-150">
          <Play className="w-10 h-10 text-white/90" fill="currentColor" />
        </div>
      )}

      {/* Kill flash overlay */}
      {showKillFlash && (
        <div className="absolute inset-0 animate-kill-flash" />
      )}

      {/* Winner/Killed badges */}
      <div className="absolute top-2 left-2 flex gap-1.5">
        {clip.winner && (
          <div className="w-5 h-5 rounded-full bg-[var(--feedr-success)] flex items-center justify-center">
            <Star className="w-3 h-3 text-black" fill="currentColor" />
          </div>
        )}
        {clip.killed && (
          <div className="w-5 h-5 rounded-full bg-[var(--feedr-danger)] flex items-center justify-center">
            <X className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Variant ID badge */}
      {isReady && (
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-xs font-medium uppercase">
          {clip.variant_id}
        </div>
      )}
    </button>
  );
}

function SkeletonTile() {
  return (
    <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-[var(--feedr-surface)] border border-[var(--feedr-border)]">
      <div className="absolute inset-0 shimmer" />
    </div>
  );
}

export function ResultsGrid({ clips, onClipClick, isLoading, batchSize }: ResultsGridProps) {
  const [newClipIds, setNewClipIds] = useState<Set<string>>(new Set());
  const prevClipsRef = useRef<Clip[]>([]);

  // Only show slots for actual batch size - no extra empty rows
  const slotCount = clips.length > 0
    ? clips.length
    : (isLoading && batchSize ? batchSize : 0);

  // Track newly ready clips for animation
  useEffect(() => {
    const prevReadyIds = new Set(
      prevClipsRef.current
        .filter((c) => c.status === "ready")
        .map((c) => c.id)
    );
    
    const newReadyClips = clips.filter(
      (c) => c.status === "ready" && !prevReadyIds.has(c.id)
    );

    if (newReadyClips.length > 0) {
      const newIds = new Set(newReadyClips.map((c) => c.id));
      setNewClipIds(newIds);
      
      // Clear animation flag after animation completes
      setTimeout(() => {
        setNewClipIds(new Set());
      }, 300);
    }

    prevClipsRef.current = clips;
  }, [clips]);

  const tiles = [];
  
  for (let i = 0; i < slotCount; i++) {
    if (clips[i]) {
      tiles.push(
        <ClipTile
          key={clips[i].id}
          clip={clips[i]}
          index={i}
          onClick={() => onClipClick(i)}
          isNew={newClipIds.has(clips[i].id)}
        />
      );
    } else if (isLoading) {
      tiles.push(<SkeletonTile key={`skeleton-${i}`} />);
    } else {
      tiles.push(
        <div
          key={`empty-${i}`}
          className="aspect-[9/16] rounded-xl bg-[var(--feedr-surface)]/50 border border-[var(--feedr-border)]/50"
        />
      );
    }
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {tiles}
    </div>
  );
}
