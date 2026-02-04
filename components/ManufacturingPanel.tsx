"use client";

import { cn } from "@/lib/utils";
import type { Clip, Batch } from "@/lib/types";
import { Check, Loader2, Sparkles, Mic, Video, Layers, Image, Zap } from "lucide-react";
import { useEffect, useState } from "react";

interface ManufacturingPanelProps {
  clips: Clip[];
  batch: Batch;
  recentWinners?: Clip[];
}

interface PipelineStep {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  isComplete: boolean;
  isActive: boolean;
}

function getStepsFromClips(clips: Clip[], outputType: string = "video"): PipelineStep[] {
  const statusCounts: Record<string, number> = {
    planned: 0,
    scripting: 0,
    vo: 0,
    rendering: 0,
    generating: 0,
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
  const hasScripting = statusCounts.scripting > 0 || statusCounts.vo > 0 || statusCounts.rendering > 0 || statusCounts.generating > 0 || statusCounts.assembling > 0 || readyCount > 0;
  const hasVo = statusCounts.vo > 0 || statusCounts.rendering > 0 || statusCounts.assembling > 0 || readyCount > 0;
  const hasRendering = statusCounts.rendering > 0 || statusCounts.generating > 0 || statusCounts.assembling > 0 || readyCount > 0;
  const hasAssembling = statusCounts.assembling > 0 || readyCount > 0;
  const allReady = readyCount === total && total > 0;

  // Image pipeline (simpler)
  if (outputType === "image") {
    return [
      {
        id: "brain",
        icon: <Sparkles className="w-4 h-4" />,
        label: "Understanding",
        description: "Parsing your intent...",
        isComplete: hasStarted,
        isActive: !hasStarted,
      },
      {
        id: "prompt",
        icon: <Zap className="w-4 h-4" />,
        label: "Prompting",
        description: "Crafting image prompts...",
        isComplete: hasScripting,
        isActive: hasStarted && !hasScripting,
      },
      {
        id: "generate",
        icon: <Image className="w-4 h-4" />,
        label: "Generating",
        description: "Creating images...",
        isComplete: allReady,
        isActive: hasScripting && !allReady,
      },
    ];
  }

  // Video pipeline (full)
  return [
    {
      id: "brain",
      icon: <Sparkles className="w-4 h-4" />,
      label: "Understanding",
      description: "Parsing your intent...",
      isComplete: hasStarted,
      isActive: !hasStarted,
    },
    {
      id: "script",
      icon: <Zap className="w-4 h-4" />,
      label: "Scripting",
      description: "Writing viral hooks...",
      isComplete: hasVo,
      isActive: hasStarted && statusCounts.scripting > 0,
    },
    {
      id: "voice",
      icon: <Mic className="w-4 h-4" />,
      label: "Voice",
      description: "Recording audio...",
      isComplete: hasRendering,
      isActive: statusCounts.vo > 0,
    },
    {
      id: "video",
      icon: <Video className="w-4 h-4" />,
      label: "Rendering",
      description: "Generating visuals...",
      isComplete: hasAssembling,
      isActive: statusCounts.rendering > 0,
    },
    {
      id: "assemble",
      icon: <Layers className="w-4 h-4" />,
      label: "Assembly",
      description: "Combining layers...",
      isComplete: allReady,
      isActive: statusCounts.assembling > 0,
    },
  ];
}

// Animated dots for active step
function AnimatedDots() {
  const [dots, setDots] = useState("");
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".");
    }, 400);
    return () => clearInterval(interval);
  }, []);
  
  return <span className="w-4 inline-block">{dots}</span>;
}

// Flowing particles animation
function FlowingParticles({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-[#2EE6C9] rounded-full animate-flow"
          style={{
            left: `${20 + i * 30}%`,
            animationDelay: `${i * 0.3}s`,
          }}
        />
      ))}
    </div>
  );
}

export function ManufacturingPanel({ clips, batch, recentWinners = [] }: ManufacturingPanelProps) {
  const outputType = (batch as any).output_type || "video";
  const steps = getStepsFromClips(clips, outputType);
  const readyCount = clips.filter((c) => c.status === "ready").length;
  const totalCount = clips.length;
  const allDone = readyCount === totalCount && totalCount > 0;
  const activeStepIndex = steps.findIndex(s => s.isActive);

  return (
    <div className="bg-[#0F1318] border border-[#2D3748] rounded-2xl overflow-hidden">
      {/* Header with gradient */}
      <div className="relative bg-gradient-to-r from-[#2EE6C9]/10 to-[#0095FF]/10 px-6 py-4 border-b border-[#2D3748]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              {allDone ? (
                <>
                  <Check className="w-4 h-4 text-[#2EE6C9]" />
                  Ready
                </>
              ) : (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#2EE6C9]" />
                  Manufacturing
                </>
              )}
            </h3>
            <p className="text-xs text-[#6B7280] mt-1">
              {outputType === "image" ? "Image Pack" : "Video Batch"}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">
              {readyCount}<span className="text-[#6B7280]">/{totalCount}</span>
            </div>
            <p className="text-xs text-[#6B7280]">completed</p>
          </div>
        </div>
      </div>

      {/* Input Section */}
      <div className="px-6 py-4 border-b border-[#2D3748]/50">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#2EE6C9]/10 flex items-center justify-center flex-shrink-0">
            <span className="text-sm">📝</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1">Your Prompt</p>
            <p className="text-sm text-white truncate">{batch.intent_text}</p>
          </div>
        </div>
      </div>

      {/* Pipeline Visualization */}
      <div className="px-6 py-5">
        <p className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-4">Pipeline</p>
        
        <div className="relative">
          {/* Connection line */}
          <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-[#2D3748]">
            <div 
              className="w-full bg-gradient-to-b from-[#2EE6C9] to-[#0095FF] transition-all duration-500 ease-out"
              style={{ 
                height: allDone ? '100%' : `${Math.max(0, (activeStepIndex / (steps.length - 1)) * 100)}%` 
              }}
            />
          </div>

          {/* Steps */}
          <div className="space-y-4 relative">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-start gap-4 transition-all duration-300",
                  step.isComplete && "opacity-100",
                  step.isActive && "opacity-100",
                  !step.isComplete && !step.isActive && "opacity-40"
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    "relative w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 z-10",
                    step.isComplete && "bg-[#2EE6C9] text-[#0B0E11]",
                    step.isActive && "bg-[#2EE6C9]/20 text-[#2EE6C9] ring-2 ring-[#2EE6C9]/50 ring-offset-2 ring-offset-[#0F1318]",
                    !step.isComplete && !step.isActive && "bg-[#1C2230] text-[#6B7280]"
                  )}
                >
                  {step.isComplete ? (
                    <Check className="w-4 h-4" />
                  ) : step.isActive ? (
                    <div className="animate-pulse">{step.icon}</div>
                  ) : (
                    step.icon
                  )}
                  
                  {/* Pulse effect for active */}
                  {step.isActive && (
                    <div className="absolute inset-0 rounded-lg bg-[#2EE6C9]/30 animate-ping" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2">
                    <p className={cn(
                      "text-sm font-medium transition-colors",
                      step.isComplete && "text-[#2EE6C9]",
                      step.isActive && "text-white",
                      !step.isComplete && !step.isActive && "text-[#6B7280]"
                    )}>
                      {step.label}
                    </p>
                    {step.isActive && <AnimatedDots />}
                  </div>
                  <p className={cn(
                    "text-xs mt-0.5 transition-colors",
                    step.isActive ? "text-[#9CA3AF]" : "text-[#4B5563]"
                  )}>
                    {step.description}
                  </p>
                </div>

                {/* Status badge */}
                <div className="pt-1">
                  {step.isComplete ? (
                    <span className="text-[10px] text-[#2EE6C9] bg-[#2EE6C9]/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Done
                    </span>
                  ) : step.isActive ? (
                    <span className="text-[10px] text-[#0095FF] bg-[#0095FF]/10 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                      Active
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Output Preview Section */}
      <div className="px-6 py-4 border-t border-[#2D3748]/50 bg-[#0B0E11]/50">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0095FF]/10 flex items-center justify-center flex-shrink-0">
            <span className="text-sm">{outputType === "image" ? "🖼️" : "🎬"}</span>
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1">Output</p>
            <p className="text-sm text-white">
              {allDone 
                ? `${readyCount} ${outputType}s ready!` 
                : `Generating ${totalCount} ${outputType}s...`
              }
            </p>
          </div>
        </div>

        {/* Mini preview of ready clips */}
        {readyCount > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {clips.filter(c => c.status === "ready").slice(0, 5).map((clip) => (
              <div
                key={clip.id}
                className="flex-shrink-0 w-12 h-16 rounded-lg overflow-hidden bg-[#1C2230] border border-[#2EE6C9]/30 relative group"
              >
                {clip.final_url || clip.image_url ? (
                  outputType === "image" ? (
                    <img
                      src={clip.image_url || clip.final_url || ""}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      src={clip.final_url || ""}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      playsInline
                      autoPlay
                    />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-[#2EE6C9]" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
            {readyCount > 5 && (
              <div className="flex-shrink-0 w-12 h-16 rounded-lg bg-[#1C2230] border border-[#2D3748] flex items-center justify-center">
                <span className="text-xs text-[#6B7280]">+{readyCount - 5}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add custom animation styles */}
      <style jsx>{`
        @keyframes flow {
          0% {
            top: 0%;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            top: 100%;
            opacity: 0;
          }
        }
        .animate-flow {
          animation: flow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
