"use client";

import { cn } from "@/lib/utils";
import type { Clip, Batch } from "@/lib/types";
import { Check, Loader2 } from "lucide-react";

interface ManufacturingPanelProps {
  clips: Clip[];
  batch: Batch;
  recentWinners?: Clip[];
}

interface Step {
  id: string;
  label: string;
  isComplete: boolean;
  isActive: boolean;
}

function getStepsFromClips(clips: Clip[]): Step[] {
  const statusCounts: Record<string, number> = {
    planned: 0,
    scripting: 0,
    vo: 0,
    rendering: 0,
    assembling: 0,
    ready: 0,
    failed: 0,
  };

  clips.forEach((clip) => {
    if (statusCounts[clip.status] !== undefined) {
      statusCounts[clip.status]++;
    }
  });

  const total = clips.length || 1;
  const readyCount = statusCounts.ready;

  const hasStarted = clips.length > 0;
  const hasScripting = statusCounts.scripting > 0 || statusCounts.vo > 0 || statusCounts.rendering > 0 || statusCounts.assembling > 0 || readyCount > 0;
  const hasVo = statusCounts.vo > 0 || statusCounts.rendering > 0 || statusCounts.assembling > 0 || readyCount > 0;
  const hasRendering = statusCounts.rendering > 0 || statusCounts.assembling > 0 || readyCount > 0;
  const hasAssembling = statusCounts.assembling > 0 || readyCount > 0;
  const allReady = readyCount === total && total > 0;

  const activeStep = !hasStarted
    ? "interpret"
    : !hasScripting
    ? "style"
    : statusCounts.scripting > 0
    ? "scripts"
    : statusCounts.vo > 0
    ? "voice"
    : statusCounts.rendering > 0
    ? "render"
    : statusCounts.assembling > 0
    ? "assemble"
    : "done";

  return [
    {
      id: "interpret",
      label: "Reading intent",
      isComplete: hasStarted,
      isActive: activeStep === "interpret",
    },
    {
      id: "style",
      label: "Selecting style",
      isComplete: hasScripting,
      isActive: activeStep === "style",
    },
    {
      id: "scripts",
      label: "Writing scripts",
      isComplete: hasVo,
      isActive: activeStep === "scripts",
    },
    {
      id: "voice",
      label: "Recording voice",
      isComplete: hasRendering,
      isActive: activeStep === "voice",
    },
    {
      id: "render",
      label: "Rendering video",
      isComplete: hasAssembling,
      isActive: activeStep === "render",
    },
    {
      id: "assemble",
      label: "Assembling clips",
      isComplete: allReady,
      isActive: activeStep === "assemble",
    },
  ];
}

const modeLabels: Record<string, string> = {
  hook_test: "HOOKS",
  angle_test: "ANGLES",
  format_test: "FORMATS",
};

export function ManufacturingPanel({ clips, batch, recentWinners = [] }: ManufacturingPanelProps) {
  const steps = getStepsFromClips(clips);
  const readyCount = clips.filter((c) => c.status === "ready").length;
  const totalCount = clips.length;
  const allDone = readyCount === totalCount && totalCount > 0;

  return (
    <div className="bg-[var(--feedr-surface)] border border-[var(--feedr-border)] rounded-xl p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--feedr-text)] uppercase tracking-wider">
          {allDone ? "Tray is full" : "Cooking clips..."}
        </h3>
        <p className="text-xs text-[var(--feedr-text-muted)] mt-1.5 truncate">
          {batch.intent_text}
        </p>
      </div>

      {/* What's locked vs testing */}
      <div className="bg-[var(--feedr-bg)] rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--feedr-text-muted)] uppercase tracking-wider">Testing</span>
          <span className="text-[var(--feedr-teal)] font-semibold uppercase tracking-wider">
            {modeLabels[batch.mode] || batch.mode}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--feedr-text-muted)] uppercase tracking-wider">Preset</span>
          <span className="text-[var(--feedr-text-secondary)] font-medium uppercase tracking-wider">
            {batch.preset_key}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--feedr-text-muted)] uppercase tracking-wider">Batch</span>
          <span className="text-[var(--feedr-text-secondary)] font-medium">
            {batch.batch_size} clips
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-[var(--feedr-text-muted)] uppercase tracking-wider">Progress</span>
          <span className="text-[var(--feedr-text)] font-medium">
            {readyCount}/{totalCount}
          </span>
        </div>
        <div className="h-1 bg-[var(--feedr-border)] rounded-full overflow-hidden">
          <div
            className="h-full feedr-gradient transition-all duration-500 ease-out"
            style={{
              width: totalCount > 0 ? `${(readyCount / totalCount) * 100}%` : "0%",
            }}
          />
        </div>
      </div>

      {/* Steps list */}
      <div className="space-y-2.5">
        {steps.map((step) => (
          <div
            key={step.id}
            className={cn(
              "flex items-center gap-3 text-xs transition-colors duration-150",
              step.isComplete && "text-[var(--feedr-text)]",
              step.isActive && !step.isComplete && "text-[var(--feedr-text)]",
              !step.isComplete && !step.isActive && "text-[var(--feedr-text-disabled)]"
            )}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              {step.isComplete ? (
                <Check className="w-4 h-4 text-[var(--feedr-success)]" />
              ) : step.isActive ? (
                <Loader2 className="w-4 h-4 animate-spin text-[var(--feedr-teal)]" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--feedr-text-disabled)]" />
              )}
            </div>
            <span className="uppercase tracking-wider">{step.label}</span>
          </div>
        ))}
      </div>

      {/* Recent winners (warm-up scroll) */}
      {recentWinners.length > 0 && (
        <div className="pt-4 border-t border-[var(--feedr-border)]">
          <p className="text-xs text-[var(--feedr-text-muted)] uppercase tracking-wider mb-3">
            Recent winners
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentWinners.slice(0, 6).map((clip) => (
              <div
                key={clip.id}
                className="flex-shrink-0 w-12 h-20 rounded-lg overflow-hidden bg-[var(--feedr-bg)] border border-[var(--feedr-border)]"
              >
                {clip.final_url && (
                  <video
                    src={clip.final_url}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    autoPlay
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
