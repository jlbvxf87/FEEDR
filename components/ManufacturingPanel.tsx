"use client";

import { cn, normalizeUIState } from "@/lib/utils";
import type { Clip, Batch } from "@/lib/types";
import { useMemo, useState, useEffect } from "react";
import { PipelineFeed } from "./PipelineFeed";

interface ManufacturingPanelProps {
  clips: Clip[];
  batch: Batch & { estimated_cost?: number };
  recentWinners?: Clip[];
  onCancel?: () => void;
  videoService?: "sora" | "kling";
}

interface Node {
  id: string;
  label: string;
  icon: string;
  status: "pending" | "active" | "complete";
  estimatedSeconds: number;
}

function getStepTimes(videoService: "sora" | "kling") {
  const videoSeconds = videoService === "kling" ? 240 : 360; // Kling ~4m, Sora ~6m typical
  return {
    input: 0,
    research: 45,  // Brain + Apify scraping + analysis
    script: 10,
    voice: 12,
    video: videoSeconds,
    merge: 15,
    output: 0,
    prompt: 10,
    generate: 30,
  };
}

function getNodes(clips: Clip[], outputType: string, batchStatus: string, hasResearch: boolean, videoService: "sora" | "kling"): Node[] {
  const stepTimes = getStepTimes(videoService);
  const statusCounts: Record<string, number> = {
    queued: 0,
    writing: 0,
    voicing: 0,
    submitting: 0,
    rendering: 0,
    rendering_delayed: 0,
    assembling: 0,
    ready: 0,
    failed_not_charged: 0,
    failed_charged: 0,
    canceled: 0,
    planned: 0,
    scripting: 0,
    vo: 0,
    generating: 0,
    failed: 0,
  };

  clips.forEach((clip) => {
    const state = normalizeUIState(clip.ui_state, clip.status);
    if (statusCounts[state] !== undefined) {
      statusCounts[state]++;
    }
  });

  const total = clips.length || 1;
  const readyCount = statusCounts.ready;
  const hasStarted = clips.length > 0;
  
  // Research phase tracking
  const isResearching = batchStatus === "researching";
  const researchComplete = hasResearch || batchStatus === "running" || statusCounts.scripting > 0 || readyCount > 0;
  
  // Use data presence for accurate parallel pipeline tracking
  // (clip.status can be misleading when TTS and Video run in parallel)
  const hasVoiceData = clips.some(c => c.voice_url);
  const hasVideoData = clips.some(c => c.raw_video_url);

  const hasScripting = statusCounts.writing > 0 || statusCounts.voicing > 0 || statusCounts.rendering > 0 || statusCounts.rendering_delayed > 0 || statusCounts.assembling > 0 || readyCount > 0;
  const hasVo = statusCounts.voicing > 0 || hasVoiceData || statusCounts.rendering > 0 || statusCounts.rendering_delayed > 0 || statusCounts.assembling > 0 || readyCount > 0;
  const hasRendering = statusCounts.rendering > 0 || statusCounts.rendering_delayed > 0 || hasVideoData || statusCounts.assembling > 0 || readyCount > 0;
  const hasAssembling = statusCounts.assembling > 0 || readyCount > 0;
  const allReady = readyCount === total && total > 0;

  const getStatus = (complete: boolean, active: boolean): Node["status"] => {
    if (complete) return "complete";
    if (active) return "active";
    return "pending";
  };

  if (outputType === "image") {
    return [
      { id: "input", label: "Input", icon: "📝", status: "complete", estimatedSeconds: stepTimes.input },
      { id: "research", label: "Research", icon: "🔍", status: getStatus(researchComplete, isResearching), estimatedSeconds: stepTimes.research },
      { id: "prompt", label: "Prompt", icon: "⚡", status: getStatus(hasScripting, researchComplete && !hasScripting), estimatedSeconds: stepTimes.prompt },
      { id: "generate", label: "Generate", icon: "🎨", status: getStatus(allReady, hasScripting && !allReady), estimatedSeconds: stepTimes.generate },
      { id: "output", label: "Output", icon: "✨", status: getStatus(allReady, false), estimatedSeconds: stepTimes.output },
    ];
  }

  return [
    { id: "input", label: "Input", icon: "📝", status: "complete", estimatedSeconds: stepTimes.input },
    { id: "research", label: "Research", icon: "🔍", status: getStatus(researchComplete, isResearching), estimatedSeconds: stepTimes.research },
    { id: "script", label: "Script", icon: "✍️", status: getStatus(hasVo, researchComplete && statusCounts.scripting > 0), estimatedSeconds: stepTimes.script },
    { id: "voice", label: "Voice", icon: "🎙️", status: getStatus(hasRendering || hasVoiceData, statusCounts.vo > 0 && !hasVoiceData), estimatedSeconds: stepTimes.voice },
    { id: "video", label: "Video", icon: "🎬", status: getStatus(hasAssembling, hasRendering && !hasAssembling), estimatedSeconds: stepTimes.video },
    { id: "merge", label: "Merge", icon: "🔗", status: getStatus(allReady, statusCounts.assembling > 0), estimatedSeconds: stepTimes.merge },
    { id: "output", label: "Output", icon: "✨", status: getStatus(allReady, false), estimatedSeconds: stepTimes.output },
  ];
}

// Engaging status messages — keeps users entertained during each step
const STATUS_MESSAGES: Record<string, string[]> = {
  research: [
    "Scanning TikTok for what's popping...",
    "Finding hooks that stopped the scroll...",
    "Analyzing 1000s of viral patterns...",
    "Extracting the winning formulas...",
    "Learning what makes people watch...",
    "Decoding the algorithm's favorites...",
  ],
  script: [
    "Writing hooks that stop the scroll...",
    "Crafting your unique variations...",
    "Mixing proven patterns with fresh angles...",
    "Sharpening every word for impact...",
    "Making each script different but lethal...",
  ],
  voice: [
    "Recording natural voiceover...",
    "Dialing in the perfect tone...",
    "Making it sound like a real creator...",
    "Adding the right energy and pacing...",
  ],
  video: [
    "Rendering each frame with AI precision...",
    "Piecing together cinematic visuals...",
    "Teaching pixels to tell your story...",
    "Generating scenes frame by frame...",
    "Rendering is cooking... almost there...",
    "Still rendering — quality takes a moment...",
    "Wrangling AI neurons into art...",
    "Painting with light and motion...",
    "Your video is taking shape...",
  ],
  merge: [
    "Syncing voice to visuals...",
    "Layering on screen text...",
    "Final assembly — stitching it together...",
    "Adding the finishing touches...",
    "Almost ready for you...",
  ],
  prompt: [
    "Crafting the perfect image prompts...",
    "Optimizing for visual impact...",
  ],
  generate: [
    "Generating your images...",
    "Bringing your visuals to life...",
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

// Live preview of content created so far — keeps users engaged during video generation
function ContentPreview({ clips, activeStepId, elapsedSeconds, batchCreatedAt, videoService }: {
  clips: Clip[];
  activeStepId?: string;
  elapsedSeconds: number;
  batchCreatedAt: string;
  videoService: "sora" | "kling";
}) {
  const [expandedClip, setExpandedClip] = useState(0);
  const clip = clips[expandedClip] || clips[0];

  // Calculate how long the video step has been running
  const videoStepElapsed = useMemo(() => {
    if (activeStepId !== "video") return 0;
    // Approximate: total elapsed minus earlier steps (~67s for research+script+voice)
    return Math.max(0, elapsedSeconds - 67);
  }, [activeStepId, elapsedSeconds]);

  const hasScript = !!clip?.script_spoken;
  const hasVoice = !!clip?.voice_url;
  const hasSoraPrompt = !!clip?.sora_prompt;
  const isVideoStep = activeStepId === "video";
  const videoEtaSeconds = videoService === "kling" ? 240 : 360;
  const videoServiceLabel = videoService === "kling" ? "Kling" : "Sora";

  return (
    <div className="px-5 py-4 border-t border-[#1C2230] space-y-3">
      {/* Clip selector tabs */}
      {clips.length > 1 && (
        <div className="flex gap-2 mb-2">
          {clips.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setExpandedClip(i)}
              className={cn(
                "text-[10px] px-2.5 py-1 rounded-full border transition-all",
                expandedClip === i
                  ? "border-[#0095FF] bg-[#0095FF]/10 text-[#0095FF]"
                  : "border-[#2A3241] text-[#4B5563] hover:text-[#6B7A8F]"
              )}
            >
              {c.variant_id}
            </button>
          ))}
        </div>
      )}

      {/* Script preview */}
      {hasScript && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-[#2EE6C9] uppercase tracking-wider">Script</p>
          <p className="text-xs text-[#9CA3AF] leading-relaxed">
            &ldquo;{clip.script_spoken}&rdquo;
          </p>
        </div>
      )}

      {/* Voice preview */}
      {hasVoice && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-[#2EE6C9] uppercase tracking-wider">Voiceover</p>
          <audio
            src={clip.voice_url!}
            controls
            className="w-full h-8 opacity-80"
            style={{ filter: "invert(1) hue-rotate(180deg)", maxHeight: "32px" }}
          />
        </div>
      )}

      {/* Video prompt + video step timer */}
      {hasSoraPrompt && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium text-[#0095FF] uppercase tracking-wider">
              Video Prompt
            </p>
            {isVideoStep && videoStepElapsed > 0 && (
              <span className="text-[10px] text-[#4B5563]">
                Rendering: {formatTime(videoStepElapsed)} / ~{Math.round(videoEtaSeconds / 60)}m ({videoServiceLabel})
              </span>
            )}
          </div>
          <p className="text-xs text-[#6B7A8F] leading-relaxed italic">
            {clip.sora_prompt}
          </p>
        </div>
      )}
    </div>
  );
}

export function ManufacturingPanel({ clips, batch, onCancel, videoService = "sora" }: ManufacturingPanelProps) {
  const outputType = batch.output_type || "video";
  const estimatedCost = batch.estimated_cost || 0;
  const hasResearch = !!batch.research_json;
  const nodes = useMemo(
    () => getNodes(clips, outputType, batch.status, hasResearch, videoService),
    [clips, outputType, batch.status, hasResearch, videoService]
  );
  const readyCount = clips.filter((c) => normalizeUIState(c.ui_state, c.status) === "ready").length;
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

  // Rotate status messages for active step — faster for long steps
  useEffect(() => {
    if (!activeNode || allDone) return;

    const messages = activeNode.id === "video"
      ? [`${videoService === "kling" ? "Kling" : "Sora"} is rendering your video...`, ...STATUS_MESSAGES.video]
      : (STATUS_MESSAGES[activeNode.id] || ["Processing..."]);
    let index = 0;
    setStatusMessage(messages[0]);

    // Video step rotates every 8s (long wait, pace it out), others every 3s
    const intervalMs = activeNode.id === "video" ? 8000 : 3000;

    const interval = setInterval(() => {
      index = (index + 1) % messages.length;
      setStatusMessage(messages[index]);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [activeNode?.id, allDone, videoService]);

  // Track when the active step started (to measure actual step durations)
  const [activeStepStartTime, setActiveStepStartTime] = useState<number>(Date.now());
  useEffect(() => {
    setActiveStepStartTime(Date.now());
  }, [activeNode?.id]);
  const activeStepElapsed = Math.max(0, Math.floor((Date.now() - activeStepStartTime) / 1000));
  const videoEtaSeconds = videoService === "kling" ? 240 : 360;
  const showSlowModeBanner = activeNode?.id === "video" && activeStepElapsed > videoEtaSeconds;
  const slowModeLabel = videoService === "kling" ? "Kling" : "Sora";

  // Adaptive remaining time: only count pending + active steps, not completed ones
  const estimatedRemaining = useMemo(() => {
    if (allDone) return 0;
    const parallelSteps = ["video", "research", "generate"];

    let remaining = 0;
    for (const node of nodes) {
      if (node.status === "complete") continue; // Done — 0 remaining

      const multiplier = parallelSteps.includes(node.id) ? 1 : totalCount;
      const stepTotal = node.estimatedSeconds * multiplier;

      if (node.status === "active") {
        // Active step: estimate minus time already spent on this step
        remaining += Math.max(0, stepTotal - activeStepElapsed);
      } else {
        // Pending step: full estimate
        remaining += stepTotal;
      }
    }
    return remaining;
  }, [nodes, allDone, totalCount, activeStepElapsed]);

  // Detect if we've exceeded the active step's estimate
  const isOvertime = estimatedRemaining === 0 && !allDone;

  // Adaptive progress: completed steps = 100%, active step = proportional, pending = 0%
  const progress = useMemo(() => {
    if (allDone) return 100;
    const parallelSteps = ["video", "research", "generate"];

    let totalEstimated = 0;
    let completedTime = 0;

    for (const node of nodes) {
      const multiplier = parallelSteps.includes(node.id) ? 1 : totalCount;
      const stepTotal = node.estimatedSeconds * multiplier;
      totalEstimated += stepTotal;

      if (node.status === "complete") {
        completedTime += stepTotal; // Full credit for done steps
      } else if (node.status === "active") {
        // Proportional credit for active step (capped at step estimate)
        completedTime += Math.min(activeStepElapsed, stepTotal);
      }
    }
    if (totalEstimated === 0) return 0;
    // Cap at 95% until actually done
    return Math.min(95, Math.round((completedTime / totalEstimated) * 100));
  }, [nodes, allDone, totalCount, activeStepElapsed]);

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
            {isOvertime && activeNode?.id === "video" && (
              <p className="text-xs text-[#6B7A8F]">{slowModeLabel} is still rendering...</p>
            )}
            {isOvertime && activeNode?.id !== "video" && (
              <p className="text-xs text-[#F59E0B]">Taking a bit longer...</p>
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
        {showSlowModeBanner && (
          <div className="mt-3 rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-2 text-[11px] text-[#F59E0B]">
            High demand on {slowModeLabel} right now. We’re still working — this can take a few extra minutes.
          </div>
        )}

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

      {/* Live content preview — shows what's been created so far */}
      {!allDone && clips.length > 0 && clips[0].script_spoken && (
        <ContentPreview clips={clips} activeStepId={activeNode?.id} elapsedSeconds={elapsedSeconds} batchCreatedAt={batch.created_at} videoService={videoService} />
      )}

      {/* Failure summary - shown when batch has failed clips */}
      {clips.some(c => ["failed_not_charged","failed_charged","failed"].includes(normalizeUIState(c.ui_state, c.status))) && (
        <div className="px-5 py-3 border-t border-[#1C2230] bg-[#EF4444]/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚠️</span>
              <span className="text-xs text-[#EF4444]">
                {readyCount} of {totalCount} completed. {clips.filter(c => ["failed_not_charged","failed_charged","failed"].includes(normalizeUIState(c.ui_state, c.status))).length} had issues.
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
