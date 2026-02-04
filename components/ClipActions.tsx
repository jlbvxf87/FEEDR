"use client";

import { cn } from "@/lib/utils";
import { Star, X, Download } from "lucide-react";

interface ClipActionsProps {
  isWinner: boolean;
  isKilled: boolean;
  onToggleWinner: () => void;
  onToggleKilled: () => void;
  onDownload: () => void;
  disabled?: boolean;
}

export function ClipActions({
  isWinner,
  isKilled,
  onToggleWinner,
  onToggleKilled,
  onDownload,
  disabled = false,
}: ClipActionsProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Winner toggle */}
      <button
        onClick={onToggleWinner}
        disabled={disabled}
        className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center",
          "transition-all duration-200",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          isWinner
            ? "bg-[#22C55E] text-black"
            : "bg-white/10 text-white hover:bg-white/20"
        )}
        title="WINNER (W)"
      >
        <Star className="w-5 h-5" fill={isWinner ? "currentColor" : "none"} />
      </button>

      {/* Kill toggle */}
      <button
        onClick={onToggleKilled}
        disabled={disabled}
        className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center",
          "transition-all duration-200",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          isKilled
            ? "bg-[#FF4D4F] text-white"
            : "bg-white/10 text-white hover:bg-white/20"
        )}
        title="KILL (X)"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Download */}
      <button
        onClick={onDownload}
        disabled={disabled}
        className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center",
          "bg-white/10 text-white hover:bg-white/20",
          "transition-all duration-200",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
        title="DOWNLOAD (D)"
      >
        <Download className="w-5 h-5" />
      </button>
    </div>
  );
}
