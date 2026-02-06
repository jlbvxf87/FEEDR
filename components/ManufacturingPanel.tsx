"use client";

import { cn } from "@/lib/utils";
import type { Clip, Batch } from "@/lib/types";
import { useMemo, useState, useEffect } from "react";
import { PipelineFeed } from "./PipelineFeed";

interface ManufacturingPanelProps {
  clips: Clip[];
  batch: Batch & { estimated_cost?: number };
  recentWinners?: Clip[];
  onCancel?: () => void;
}

interface Node {
  id: string;
  label: string;
  icon: string;
  status: "pending" | "active" | "complete";
  estimatedSeconds: number;
}

// Estimated time in seconds for each step (for user-friendly estimates)
const STEP_TIMES = {
  input: 0,
  research: 45,  // Brain + Apify scraping + analysis
  script: 10,
  voice: 12,
  video: 180, // Sora takes 1-5 minutes; use 3 min midpoint
  merge: 8,
  output: 0,
  prompt: 10,
  generate: 30,
};

function getNodes(clips: Clip[], outputType: string, batchStatus: string, hasResearch: boolean): Node[] {
  const statusCounts: Record<string, number> = {
    planned: 0, scripting: 0, vo: 0, rendering: 0,
    generating: 0, assembling: 0, ready: 0, failed: 0,
  };

  clips.forEach((clip) => {
    if (statusCounts[clip.status] !== undefined) {
      statusCounts[clip.status]++;
    }
  });

  const total = clips.length || 1;
  const readyCount = statusCounts.ready;
  const hasStarted = clips.length > 0;
  
  // Research phase tracking
  const isResearching = batchStatus === "researching";
  const researchComplete = hasResearch || batchStatus === "running" || statusCounts.scripting > 0 || readyCount > 0;
  
  const hasScripting = statusCounts.scripting > 0 || statusCounts.vo > 0 || statusCounts.rendering > 0 || statusCounts.generating > 0 || statusCounts.assembling > 0 || readyCount > 0;
  const hasVo = statusCounts.vo > 0 || statusCounts.rendering > 0 || statusCounts.assembling > 0 || readyCount > 0;
  const hasRendering = statusCounts.rendering > 0 || statusCounts.generating > 0 || statusCounts.assembling > 0 || readyCount > 0;
  const hasAssembling = statusCounts.assembling > 0 || readyCount > 0;
  const allReady = readyCount === total && total > 0;

  const getStatus = (complete: boolean, active: boolean): Node["status"] => {
    if (complete) return "complete";
    if (active) return "active";
    return "pending";
  };

  if (outputType === "image") {
    return [
      { id: "input", label: "Input", icon: "📝", status: "complete", estimatedSeconds: STEP_TIMES.input },
      { id: "research", label: "Research", icon: "🔍", status: getStatus(researchComplete, isResearching), estimatedSeconds: STEP_TIMES.research },
      { id: "prompt", label: "Prompt", icon: "⚡", status: getStatus(hasScripting, researchComplete && !hasScripting), estimatedSeconds: STEP_TIMES.prompt },
      { id: "generate", label: "Generate", icon: "🎨", status: getStatus(allReady, hasScripting && !allReady), estimatedSeconds: STEP_TIMES.generate },
      { id: "output", label: "Output", icon: "✨", status: getStatus(allReady, false), estimatedSeconds: STEP_TIMES.output },
    ];
  }

  return [
    { id: "input", label: "Input", icon: "📝", status: "complete", estimatedSeconds: STEP_TIMES.input },
    { id: "research", label: "Research", icon: "🔍", status: getStatus(researchComplete, isResearching), estimatedSeconds: STEP_TIMES.research },
    { id: "script", label: "Script", icon: "✍️", status: getStatus(hasVo, researchComplete && statusCounts.scripting > 0), estimatedSeconds: STEP_TIMES.script },
    { id: "voice", label: "Voice", icon: "🎙️", status: getStatus(hasRendering, statusCounts.vo > 0), estimatedSeconds: STEP_TIMES.voice },
    { id: "video", label: "Video", icon: "🎬", status: getStatus(hasAssembling, statusCounts.rendering > 0), estimatedSeconds: STEP_TIMES.video },
    { id: "merge", label: "Merge", icon: "🔗", status: getStatus(allReady, statusCounts.assembling > 0), estimatedSeconds: STEP_TIMES.merge },
    { id: "output", label: "Output", icon: "✨", status: getStatus(allReady, false), estimatedSeconds: STEP_TIMES.output },
  ];
}

// Smart, conversational status messages for each step
const STATUS_MESSAGES: Record<string, string[]> = {
  research: [
    "Finding what's working right now...",
    "Analyzing viral patterns in your niche...",
    "Extracting winning formulas...",
    "Learning from proven content...",
  ],
  script: [
    "Writing hooks based on viral patterns...",
    "Crafting your unique variations...",
    "Making each script different but proven...",
  ],
  voice: [
    "Recording natural voiceover...",
    "Making it sound authentic...",
    "Adding the right energy...",
  ],
  video: [
    "Sora is creating your visuals...",
    "Rendering video content...",
    "This is where magic happens...",
  ],
  merge: [
    "Putting it all together...",
    "Final assembly in progress...",
    "Almost ready for you...",
  ],
  prompt: [
    "Crafting perfect prompts...",
    "Optimizing for quality...",
  ],
  generate: [
    "Generating your images...",
    "Creating variations...",
  ],
};

// Clean workflow node - rectangular card style
function WorkflowNode({ node, index }: { node: Node; index: number }) {
  return (
    <div 
      className="relative flex flex-col items-center"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Node card */}
      <div
        className={cn(
          "relative w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300",
          "border bg-[#1A1F2B]",
          node.status === "complete" && "border-[#2EE6C9] bg-[#2EE6C9]/10",
          node.status === "active" && "border-[#0095FF] bg-[#0095FF]/10",
          node.status === "pending" && "border-[#2A3241]"
        )}
      >
        {/* Subtle glow for active */}
        {node.status === "active" && (
          <div className="absolute inset-0 rounded-xl bg-[#0095FF]/20 animate-pulse" />
        )}

        {/* Icon */}
        <span className={cn(
          "text-xl relative z-10 transition-all duration-300",
          node.status === "pending" && "opacity-40 grayscale"
        )}>
          {node.icon}
        </span>

        {/* Checkmark badge for complete */}
        {node.status === "complete" && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#2EE6C9] flex items-center justify-center z-20 shadow-lg shadow-[#2EE6C9]/30">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0B0E11" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}

        {/* Processing indicator for active */}
        {node.status === "active" && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#0095FF] flex items-center justify-center z-20 shadow-lg shadow-[#0095FF]/30">
            <div className="w-2.5 h-2.5 border-[1.5px] border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Label */}
      <span
        className={cn(
          "mt-2 text-[11px] font-medium tracking-wide transition-colors duration-300",
          node.status === "complete" && "text-[#2EE6C9]",
          node.status === "active" && "text-white",
          node.status === "pending" && "text-[#4B5563]"
        )}
      >
        {node.label}
      </span>
    </div>
  );
}

// Clean connection line between nodes
function NodeConnection({ from, to }: { from: Node; to: Node }) {
  const isComplete = from.status === "complete" && to.status !== "pending";
  const isActive = from.status === "complete" && to.status === "active";
  const isPending = from.status !== "complete";

  return (
    <div className="relative flex items-center mx-1 h-14">
      <div className="relative w-8 h-[2px]">
        <div 
          className={cn(
            "absolute inset-0 rounded-full transition-all duration-500",
            isPending && "bg-[#2A3241]",
            isComplete && !isActive && "bg-gradient-to-r from-[#2EE6C9] to-[#2EE6C9]",
            isActive && "bg-gradient-to-r from-[#2EE6C9] to-[#0095FF]"
          )}
        />
        
        {isActive && (
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_#0095FF]"
            style={{ animation: "flowDot 1s ease-in-out infinite" }}
          />
        )}
        
        {isComplete && (
          <div 
            className={cn(
              "absolute inset-0 rounded-full blur-sm opacity-50",
              isActive ? "bg-[#0095FF]" : "bg-[#2EE6C9]"
            )}
          />
        )}
      </div>
    </div>
  );
}

function formatCost(cents: number): string {
  if (cents < 100) return `${cents}¢`;
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export function ManufacturingPanel({ clips, batch, onCancel }: ManufacturingPanelProps) {
  const outputType = batch.output_type || "video";
  const estimatedCost = batch.estimated_cost || 0;
  const hasResearch = !!batch.research_json;
  const nodes = useMemo(() => getNodes(clips, outputType, batch.status, hasResearch), [clips, outputType, batch.status, hasResearch]);
  const readyCount = clips.filter((c) => c.status === "ready").length;
  const totalCount = clips.length;
  const allDone = readyCount === totalCount && totalCount > 0;
  const activeNode = nodes.find((n) => n.status === "active");
  const completedSteps = nodes.filter((n) => n.status === "complete").length;

  // Elapsed time tracker
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    if (allDone) return;
    
    const startTime = new Date(batch.created_at).getTime();
    
    const interval = setInterval(() => {
      const now = Date.now();
      setElapsedSeconds(Math.floor((now - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [batch.created_at, allDone]);

  // Rotate status messages for active step
  useEffect(() => {
    if (!activeNode || allDone) return;
    
    const messages = STATUS_MESSAGES[activeNode.id] || ["Processing..."];
    let index = 0;
    setStatusMessage(messages[0]);
    
    const interval = setInterval(() => {
      index = (index + 1) % messages.length;
      setStatusMessage(messages[index]);
    }, 3000);

    return () => clearInterval(interval);
  }, [activeNode?.id, allDone]);

  // Calculate estimated remaining time
  const estimatedRemaining = useMemo(() => {
    if (allDone) return 0;
    const activeIndex = nodes.findIndex((n) => n.status === "active");
    if (activeIndex === -1) return 0;
    
    let remaining = 0;
    for (let i = activeIndex; i < nodes.length; i++) {
      // Video and research steps run in parallel across clips; don't multiply by count
      const parallelSteps = ["video", "research", "generate"];
      const multiplier = parallelSteps.includes(nodes[i].id) ? 1 : totalCount;
      remaining += nodes[i].estimatedSeconds * multiplier;
    }
    return Math.max(0, remaining);
  }, [nodes, allDone, totalCount]);

  // Progress percentage (time-weighted so video step doesn't show misleading 57%)
  const progress = useMemo(() => {
    if (allDone) return 100;
    const totalTime = nodes.reduce((sum, n) => sum + n.estimatedSeconds, 0);
    if (totalTime === 0) return 0;
    let completedTime = 0;
    for (const node of nodes) {
      if (node.status === "complete") {
        completedTime += node.estimatedSeconds;
      } else if (node.status === "active") {
        completedTime += node.estimatedSeconds * 0.5;
      }
    }
    return Math.min(95, Math.round((completedTime / totalTime) * 100));
  }, [nodes, allDone]);

  return (
    <div className="bg-[#0B0E11] border border-[#1C2230] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#1C2230]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {allDone ? (
              <div className="w-10 h-10 rounded-xl bg-[#2EE6C9]/20 flex items-center justify-center shadow-[0_0_20px_rgba(46,230,201,0.3)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2EE6C9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-[#0095FF]/10 border border-[#0095FF]/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,149,255,0.2)]">
                <div className="w-5 h-5 border-2 border-[#0095FF] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-white">
                {allDone 
                  ? "🎉 Ready to post!" 
                  : statusMessage || activeNode?.label || "Processing"
                }
              </h3>
              <p className="text-xs text-[#6B7A8F]">
                {allDone 
                  ? `${readyCount} proven variations in ${formatTime(elapsedSeconds)}`
                  : activeNode?.id === "research" 
                    ? "Finding viral patterns..."
                    : `Step ${completedSteps} of ${nodes.length}`
                }
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white">{readyCount}</span>
              <span className="text-sm text-[#4B5563]">/{totalCount}</span>
            </div>
            {!allDone && estimatedRemaining > 0 && (
              <p className="text-xs text-[#6B7A8F]">~{formatTime(estimatedRemaining)} left</p>
            )}
            {allDone && (
              <p className="text-xs text-[#2EE6C9] font-medium">Built from viral data ✓</p>
            )}
            {!allDone && onCancel && (
              <div className="mt-2">
                {!showCancelConfirm ? (
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="text-[10px] text-[#6B7A8F] hover:text-[#EF4444] transition-colors"
                  >
                    Cancel
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { onCancel(); setShowCancelConfirm(false); }}
                      className="text-[10px] px-2 py-1 rounded bg-[#EF4444]/20 text-[#EF4444] hover:bg-[#EF4444]/30 transition-colors"
                    >
                      Confirm cancel
                    </button>
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      className="text-[10px] text-[#6B7A8F] hover:text-white transition-colors"
                    >
                      Keep going
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {!allDone && (
          <div className="h-1.5 bg-[#1C2230] rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#A855F7] via-[#0095FF] to-[#2EE6C9] rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(0,149,255,0.5)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Completion bar */}
        {allDone && (
          <div className="h-1.5 bg-[#2EE6C9] rounded-full shadow-[0_0_10px_rgba(46,230,201,0.5)]" />
        )}
      </div>

      {/* Workflow visualization */}
      <div className="p-6 overflow-x-auto">
        <div className="flex items-center justify-center min-w-max">
          {nodes.map((node, index) => (
            <div key={node.id} className="flex items-center">
              <WorkflowNode node={node} index={index} />
              {index < nodes.length - 1 && (
                <NodeConnection from={node} to={nodes[index + 1]} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Failure summary - shown when batch has failed clips */}
      {clips.some(c => c.status === "failed") && (
        <div className="px-5 py-3 border-t border-[#1C2230] bg-[#EF4444]/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚠️</span>
              <span className="text-xs text-[#EF4444]">
                {readyCount} of {totalCount} completed. {clips.filter(c => c.status === "failed").length} had issues.
              </span>
            </div>
            {readyCount > 0 && (
              <span className="text-[10px] text-[#6B7A8F]">
                Completed variants are still available
              </span>
            )}
          </div>
        </div>
      )}

      {/* Footer with prompt and elapsed time */}
      <div className="px-5 py-3 border-t border-[#1C2230] bg-[#0F1318] flex items-center justify-between">
        <p className="text-xs text-[#6B7A8F] truncate flex-1 mr-4">
          <span className="text-[#4B5563]">Prompt:</span> {batch.intent_text}
        </p>
        {!allDone && elapsedSeconds > 0 && (
          <span className="text-xs text-[#4B5563] whitespace-nowrap">
            {formatTime(elapsedSeconds)} elapsed
          </span>
        )}
      </div>

      {/* Live Pipeline Feed - Text diagram showing content flowing through */}
      <PipelineFeed clips={clips} batch={batch} />
    </div>
  );
}
