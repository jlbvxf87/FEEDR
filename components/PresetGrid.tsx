"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Preset, PresetKey } from "@/lib/types";
import { Check } from "lucide-react";

interface PresetGridProps {
  presets: Preset[];
  selectedKey: PresetKey;
  onSelect: (key: PresetKey) => void;
  disabled?: boolean;
}

// Brand-aligned gradient backgrounds using CSS variables
const gradientClasses: Record<string, string> = {
  AUTO: "from-[#2EE6C9] to-[#1FB6FF]",
  RAW_UGC_V1: "from-[#F59E0B] to-[#EA580C]",
  TIKTOK_AD_V1: "from-[#FF4D4F] to-[#E11D48]",
  PODCAST_V1: "from-[#3A7CFF] to-[#2563EB]",
  SENSORY_V1: "from-[#10B981] to-[#2EE6C9]",
  CLEAN_V1: "from-[#64748B] to-[#475569]",
  STORY_V1: "from-[#6366F1] to-[#3A7CFF]",
  HOOK_V1: "from-[#FF4D4F] to-[#F97316]",
  MINIMAL_V1: "from-[#737373] to-[#525252]",
};

export function PresetGrid({
  presets,
  selectedKey,
  onSelect,
  disabled = false,
}: PresetGridProps) {
  const [justSelected, setJustSelected] = useState<string | null>(null);

  // Ensure we have 9 tiles
  const displayPresets = [...presets];
  while (displayPresets.length < 9) {
    displayPresets.push({
      id: `placeholder-${displayPresets.length}`,
      key: `PLACEHOLDER_${displayPresets.length}` as PresetKey,
      name: "SOON",
      description: "Coming soon",
      preview_video_url: null,
      config_json: {},
      is_active: false,
      created_at: new Date().toISOString(),
    });
  }

  const handleSelect = (key: PresetKey) => {
    if (disabled) return;
    
    // Trigger snap animation
    setJustSelected(key);
    setTimeout(() => setJustSelected(null), 150);
    
    onSelect(key);
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      {displayPresets.slice(0, 9).map((preset) => {
        const isSelected = preset.key === selectedKey;
        const isDisabled = disabled || !preset.is_active;
        const gradient = gradientClasses[preset.key] || "from-gray-600 to-gray-700";
        const isSnapping = justSelected === preset.key;

        return (
          <button
            key={preset.id}
            onClick={() => handleSelect(preset.key)}
            disabled={isDisabled}
            className={cn(
              "relative aspect-[9/16] rounded-xl overflow-hidden",
              "transition-all duration-150",
              "focus:outline-none",
              isSelected && "feedr-glow-strong ring-1 ring-[var(--feedr-teal)]/50",
              isDisabled && "opacity-30 cursor-not-allowed",
              !isDisabled && !isSelected && "hover:scale-[1.02] hover:ring-1 hover:ring-[var(--feedr-border)]",
              isSnapping && "animate-select-snap"
            )}
          >
            {/* Background gradient */}
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-80",
                gradient
              )}
            />

            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/40" />

            {/* Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-3">
              <span className="text-white font-semibold text-sm uppercase tracking-wider text-center">
                {preset.name}
              </span>
              <span className="text-white/60 text-xs text-center mt-1.5 line-clamp-2">
                {preset.description}
              </span>
            </div>

            {/* Selected indicator */}
            {isSelected && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full feedr-gradient flex items-center justify-center">
                <Check className="w-3 h-3 text-[var(--feedr-bg)]" strokeWidth={3} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
