"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { Clip } from "@/lib/types";
import { ClipActions } from "./ClipActions";
import { X, ChevronUp, ChevronDown } from "lucide-react";

interface VideoModalFeedProps {
  clips: Clip[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onToggleWinner: (clipId: string, winner: boolean) => Promise<void>;
  onToggleKilled: (clipId: string, killed: boolean) => Promise<void>;
}

export function VideoModalFeed({
  clips,
  initialIndex,
  isOpen,
  onClose,
  onToggleWinner,
  onToggleKilled,
}: VideoModalFeedProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isUpdating, setIsUpdating] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const readyClips = clips.filter((c) => c.status === "ready");
  const currentClip = readyClips[currentIndex];

  useEffect(() => {
    if (isOpen) {
      const readyIndex = readyClips.findIndex(
        (c) => c.id === clips[initialIndex]?.id
      );
      setCurrentIndex(readyIndex >= 0 ? readyIndex : 0);
    }
  }, [isOpen, initialIndex, clips, readyClips]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, readyClips.length - 1));
  }, [readyClips.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "escape":
          onClose();
          break;
        case "j":
        case "arrowdown":
          e.preventDefault();
          goToNext();
          break;
        case "k":
        case "arrowup":
          e.preventDefault();
          goToPrev();
          break;
        case "w":
          if (currentClip) {
            handleToggleWinner();
          }
          break;
        case "x":
          if (currentClip) {
            handleToggleKilled();
          }
          break;
        case "d":
          if (currentClip) {
            handleDownload();
          }
          break;
        case " ":
          e.preventDefault();
          if (videoRef.current) {
            if (videoRef.current.paused) {
              videoRef.current.play();
            } else {
              videoRef.current.pause();
            }
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentClip, goToNext, goToPrev, onClose]);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    };

    const container = containerRef.current;
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [isOpen, goToNext, goToPrev]);

  useEffect(() => {
    if (videoRef.current && currentClip?.final_url) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [currentClip?.final_url]);

  const handleToggleWinner = async () => {
    if (!currentClip || isUpdating) return;
    setIsUpdating(true);
    try {
      await onToggleWinner(currentClip.id, !currentClip.winner);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleKilled = async () => {
    if (!currentClip || isUpdating) return;
    setIsUpdating(true);
    try {
      await onToggleKilled(currentClip.id, !currentClip.killed);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDownload = () => {
    if (!currentClip?.final_url) return;
    
    const link = document.createElement("a");
    link.href = currentClip.final_url;
    link.download = `${currentClip.variant_id}.mp4`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen || !currentClip) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      onClick={(e) => {
        if (e.target === containerRef.current) {
          onClose();
        }
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Video counter */}
      <div className="absolute top-4 right-4 z-10 px-3 py-1.5 rounded-full bg-white/10 text-white text-sm font-medium uppercase tracking-wider">
        {currentIndex + 1}/{readyClips.length}
      </div>

      {/* Navigation */}
      <div className="absolute top-1/2 left-4 -translate-y-1/2 flex flex-col gap-2 z-10">
        <button
          onClick={goToPrev}
          disabled={currentIndex === 0}
          className={cn(
            "w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white transition-all",
            currentIndex === 0 ? "opacity-30" : "hover:bg-white/20"
          )}
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <button
          onClick={goToNext}
          disabled={currentIndex === readyClips.length - 1}
          className={cn(
            "w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white transition-all",
            currentIndex === readyClips.length - 1
              ? "opacity-30"
              : "hover:bg-white/20"
          )}
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* Video */}
      <div className="relative h-full max-h-[90vh] aspect-[9/16] flex items-center justify-center">
        {currentClip.final_url ? (
          <video
            ref={videoRef}
            src={currentClip.final_url}
            className="w-full h-full object-contain"
            autoPlay
            loop
            playsInline
            controls={false}
            onClick={() => {
              if (videoRef.current) {
                if (videoRef.current.paused) {
                  videoRef.current.play();
                } else {
                  videoRef.current.pause();
                }
              }
            }}
          />
        ) : (
          <div className="w-full h-full bg-[#11151C] flex items-center justify-center text-[#6B7280] text-sm uppercase tracking-wider">
            No video
          </div>
        )}

        {/* Variant ID */}
        <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg bg-black/70 text-white text-sm font-medium uppercase">
          {currentClip.variant_id}
        </div>
      </div>

      {/* Actions */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
        <ClipActions
          isWinner={currentClip.winner}
          isKilled={currentClip.killed}
          onToggleWinner={handleToggleWinner}
          onToggleKilled={handleToggleKilled}
          onDownload={handleDownload}
          disabled={isUpdating}
        />
      </div>

      {/* Keyboard hints */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-6 text-white/40 text-xs uppercase tracking-wider">
        <span>J/K Navigate</span>
        <span>W Winner</span>
        <span>X Kill</span>
        <span>D Download</span>
        <span>Esc Close</span>
      </div>
    </div>
  );
}
