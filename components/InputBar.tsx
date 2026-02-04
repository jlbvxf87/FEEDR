"use client";

import { useState } from "react";
import type { PresetKey, BatchMode, BatchSize } from "@/lib/types";
import { cn } from "@/lib/utils";

interface InputBarProps {
  onGenerate: (
    intentText: string,
    presetKey: PresetKey,
    mode: BatchMode,
    batchSize: BatchSize
  ) => void;
  selectedPreset: PresetKey;
  isGenerating: boolean;
}

export function InputBar({
  onGenerate,
  selectedPreset,
  isGenerating,
}: InputBarProps) {
  const [intentText, setIntentText] = useState("");
  const [mode, setMode] = useState<BatchMode>("hook_test");
  const [batchSize, setBatchSize] = useState<BatchSize>(4);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!intentText.trim() || isGenerating) return;
    onGenerate(intentText.trim(), selectedPreset, mode, batchSize);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative">
        <input
          type="text"
          value={intentText}
          onChange={(e) => setIntentText(e.target.value)}
          placeholder="What are we feeding today?"
          disabled={isGenerating}
          className={cn(
            "w-full px-6 py-4 rounded-xl",
            "bg-[var(--feedr-surface)] border border-[var(--feedr-border)]",
            "text-lg text-[var(--feedr-text)] placeholder:text-[var(--feedr-text-disabled)]",
            "focus:outline-none focus:border-[var(--feedr-border-focus)] feedr-input-glow",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-all duration-200"
          )}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as BatchMode)}
            disabled={isGenerating}
            className={cn(
              "px-4 py-2.5 rounded-lg",
              "bg-[var(--feedr-surface)] border border-[var(--feedr-border)]",
              "text-sm text-[var(--feedr-text)] uppercase tracking-wider",
              "focus:outline-none focus:border-[var(--feedr-border-focus)]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "cursor-pointer transition-all duration-150"
            )}
          >
            <option value="hook_test">HOOKS</option>
            <option value="angle_test">ANGLES</option>
            <option value="format_test">FORMATS</option>
          </select>

          <select
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value) as BatchSize)}
            disabled={isGenerating}
            className={cn(
              "px-4 py-2.5 rounded-lg",
              "bg-[var(--feedr-surface)] border border-[var(--feedr-border)]",
              "text-sm text-[var(--feedr-text)]",
              "focus:outline-none focus:border-[var(--feedr-border-focus)]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "cursor-pointer transition-all duration-150"
            )}
          >
            <option value={2}>2</option>
            <option value={4}>4</option>
            <option value={6}>6</option>
            <option value={8}>8</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={!intentText.trim() || isGenerating}
          className={cn(
            "px-10 py-2.5 rounded-lg font-semibold uppercase tracking-wider",
            "feedr-gradient text-[var(--feedr-bg)]",
            "hover:opacity-90",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "transition-all duration-200",
            !isGenerating && intentText.trim() && "feedr-glow"
          )}
        >
          {isGenerating ? "COOKING..." : "FEED"}
        </button>
      </div>
    </form>
  );
}
