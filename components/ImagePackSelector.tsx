"use client";

import { cn } from "@/lib/utils";
import { IMAGE_PACKS, ImagePack } from "@/lib/imagePresets";

interface ImagePackSelectorProps {
  selected: ImagePack;
  onSelect: (pack: ImagePack) => void;
  disabled?: boolean;
}

export function ImagePackSelector({ selected, onSelect, disabled }: ImagePackSelectorProps) {
  const packs = Object.entries(IMAGE_PACKS) as [ImagePack, typeof IMAGE_PACKS[ImagePack]][];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {packs.map(([key, pack]) => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          disabled={disabled}
          className={cn(
            "p-3 rounded-xl border transition-all duration-200 text-left",
            selected === key
              ? "bg-[#2EE6C9]/10 border-[#2EE6C9] ring-1 ring-[#2EE6C9]/30"
              : "bg-[#1C2230] border-[#2D3748] hover:border-[#4B5563]",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="text-xl mb-1">{pack.icon}</div>
          <div className="text-xs font-medium text-white">{pack.name}</div>
          <div className="text-[10px] text-[#6B7280] mt-0.5 line-clamp-2">
            {pack.description}
          </div>
        </button>
      ))}
    </div>
  );
}

// Compact version for inline use
export function ImagePackDropdown({ 
  selected, 
  onSelect, 
  disabled 
}: ImagePackSelectorProps) {
  return (
    <select
      value={selected}
      onChange={(e) => onSelect(e.target.value as ImagePack)}
      disabled={disabled}
      className={cn(
        "px-3 py-2.5 rounded-lg",
        "bg-[#1C2230] border border-[#2D3748]",
        "text-xs text-white",
        "disabled:opacity-50",
        "cursor-pointer"
      )}
    >
      {(Object.entries(IMAGE_PACKS) as [ImagePack, typeof IMAGE_PACKS[ImagePack]][]).map(
        ([key, pack]) => (
          <option key={key} value={key}>
            {pack.icon} {pack.name}
          </option>
        )
      )}
    </select>
  );
}
