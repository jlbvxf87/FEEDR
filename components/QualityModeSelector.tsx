"use client";

import { cn } from "@/lib/utils";
import { QualityMode, QUALITY_TIERS, estimateBatchCost, formatCost } from "@/lib/costs";

interface QualityModeSelectorProps {
  selected: QualityMode;
  onSelect: (mode: QualityMode) => void;
  outputType: "video" | "image";
  batchSize: number;
  disabled?: boolean;
}

export function QualityModeSelector({
  selected,
  onSelect,
  outputType,
  batchSize,
  disabled = false,
}: QualityModeSelectorProps) {
  const modes: QualityMode[] = ["economy", "balanced", "premium"];
  
  // Calculate costs for each mode
  const costs = modes.map(mode => estimateBatchCost(mode, outputType, batchSize));
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs text-[#6B7280] uppercase tracking-wider">
          Quality Mode
        </label>
        <span className="text-xs text-[#2EE6C9]">
          Est. {formatCost(costs[modes.indexOf(selected)].totalCents)}
        </span>
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        {modes.map((mode, index) => {
          const tier = QUALITY_TIERS[mode];
          const cost = costs[index];
          const isSelected = selected === mode;
          
          return (
            <button
              key={mode}
              onClick={() => onSelect(mode)}
              disabled={disabled}
              className={cn(
                "relative p-3 rounded-xl border transition-all duration-200",
                "flex flex-col items-center gap-1",
                isSelected
                  ? "bg-[#2EE6C9]/10 border-[#2EE6C9] shadow-lg shadow-[#2EE6C9]/10"
                  : "bg-[#1C2230] border-[#2D3748] hover:border-[#2EE6C9]/30",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {/* Recommended badge */}
              {mode === "balanced" && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#2EE6C9] text-[#0B0E11] text-[9px] font-bold uppercase tracking-wider rounded-full">
                  Best Value
                </span>
              )}
              
              {/* Icon */}
              <span className="text-2xl">{tier.icon}</span>
              
              {/* Label */}
              <span className={cn(
                "text-sm font-medium",
                isSelected ? "text-white" : "text-[#9CA3AF]"
              )}>
                {tier.label}
              </span>
              
              {/* Cost */}
              <span className={cn(
                "text-xs",
                isSelected ? "text-[#2EE6C9]" : "text-[#6B7280]"
              )}>
                {formatCost(cost.totalCents)}
              </span>
              
              {/* Description on hover/selected */}
              {isSelected && (
                <span className="text-[10px] text-[#6B7280] text-center mt-1">
                  {tier.description}
                </span>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Cost breakdown */}
      <div className="bg-[#0B0E11] rounded-lg p-3">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-[#6B7280]">Cost Breakdown</span>
          <span className="text-[#2EE6C9] font-medium">
            {formatCost(costs[modes.indexOf(selected)].perItemCents)}/{outputType === "video" ? "video" : "image"}
          </span>
        </div>
        <div className="space-y-1">
          {Object.entries(costs[modes.indexOf(selected)].breakdown).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between text-[10px]">
              <span className="text-[#6B7280] capitalize">{key}</span>
              <span className="text-[#9CA3AF]">{formatCost(value as number)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Compact inline selector for the main input row
export function QualityModeToggle({
  selected,
  onSelect,
  disabled = false,
}: {
  selected: QualityMode;
  onSelect: (mode: QualityMode) => void;
  disabled?: boolean;
}) {
  const modes: QualityMode[] = ["economy", "balanced", "premium"];
  
  return (
    <div className="flex rounded-lg overflow-hidden border border-[#2D3748]">
      {modes.map((mode) => {
        const tier = QUALITY_TIERS[mode];
        const isSelected = selected === mode;
        
        return (
          <button
            key={mode}
            onClick={() => onSelect(mode)}
            disabled={disabled}
            title={tier.description}
            className={cn(
              "px-2.5 py-2 text-sm transition-all",
              isSelected
                ? "bg-[#2EE6C9] text-[#0B0E11]"
                : "bg-[#1C2230] text-[#6B7280] hover:text-white",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {tier.icon}
          </button>
        );
      })}
    </div>
  );
}
