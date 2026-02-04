"use client";

import { cn } from "@/lib/utils";
import type { Clip, Batch } from "@/lib/types";
import { useMemo } from "react";

interface ManufacturingPanelProps {
  clips: Clip[];
  batch: Batch & { estimated_cost?: number };
  recentWinners?: Clip[];
}

interface Node {
  id: string;
  label: string;
  icon: string;
  status: "pending" | "active" | "complete";
}

function getNodes(clips: Clip[], outputType: string): Node[] {
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
      { id: "input", label: "Input", icon: "📝", status: "complete" },
      { id: "brain", label: "Brain", icon: "🧠", status: getStatus(hasStarted, !hasStarted) },
      { id: "prompt", label: "Prompt", icon: "⚡", status: getStatus(hasScripting, hasStarted && !hasScripting) },
      { id: "generate", label: "Generate", icon: "🎨", status: getStatus(allReady, hasScripting && !allReady) },
      { id: "output", label: "Output", icon: "✨", status: getStatus(allReady, false) },
    ];
  }

  return [
    { id: "input", label: "Input", icon: "📝", status: "complete" },
    { id: "brain", label: "Brain", icon: "🧠", status: getStatus(hasStarted, !hasStarted) },
    { id: "script", label: "Script", icon: "✍️", status: getStatus(hasVo, hasStarted && statusCounts.scripting > 0) },
    { id: "voice", label: "Voice", icon: "🎙️", status: getStatus(hasRendering, statusCounts.vo > 0) },
    { id: "video", label: "Video", icon: "🎬", status: getStatus(hasAssembling, statusCounts.rendering > 0) },
    { id: "merge", label: "Merge", icon: "🔗", status: getStatus(allReady, statusCounts.assembling > 0) },
    { id: "output", label: "Output", icon: "✨", status: getStatus(allReady, false) },
  ];
}

// SVG Gear - 12 teeth, spins based on status
function GearIcon({ status, size = 32 }: { status: Node["status"]; size?: number }) {
  const teeth = 12;
  const innerR = size * 0.25;
  const outerR = size * 0.45;
  const points: string[] = [];

  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / teeth - Math.PI / 2;
    const x = size / 2 + r * Math.cos(angle);
    const y = size / 2 + r * Math.sin(angle);
    points.push(`${x},${y}`);
  }

  const pathD = `M ${points.join(" L ")} Z`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      <defs>
        <linearGradient id="gearComplete" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2EE6C9" />
          <stop offset="100%" stopColor="#1FB6FF" />
        </linearGradient>
        <linearGradient id="gearActive" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0095FF" />
          <stop offset="100%" stopColor="#2EE6C9" />
        </linearGradient>
        <filter id="gearGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d={pathD}
        fill="none"
        stroke={status === "complete" ? "url(#gearComplete)" : status === "active" ? "url(#gearActive)" : "#2A3241"}
        strokeWidth={2}
        strokeLinejoin="round"
        className={cn(
          "transition-all duration-500",
          status === "complete" && "drop-shadow-[0_0_8px_rgba(46,230,201,0.6)]",
          status === "active" && "drop-shadow-[0_0_8px_rgba(0,149,255,0.6)]"
        )}
        style={{
          animation: status === "active" || status === "complete" ? "gearSpin 2s linear infinite" : "none",
        }}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={size * 0.12}
        fill={status === "complete" ? "#2EE6C9" : status === "active" ? "#0095FF" : "#1A1F2B"}
        stroke={status === "complete" ? "#2EE6C9" : status === "active" ? "#0095FF" : "#2A3241"}
        strokeWidth={1.5}
        className="transition-all duration-500"
      />
    </svg>
  );
}

// Single gear node
function GearNode({ node, index }: { node: Node; index: number }) {
  return (
    <div className="relative flex flex-col items-center" style={{ animationDelay: `${index * 0.1}s` }}>
      <div
        className={cn(
          "relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500",
          "border-2",
          node.status === "complete" && "border-[#2EE6C9]/50 bg-[#2EE6C9]/10 shadow-[0_0_24px_rgba(46,230,201,0.25)]",
          node.status === "active" && "border-[#0095FF]/50 bg-[#0095FF]/10 shadow-[0_0_24px_rgba(0,149,255,0.25)]",
          node.status === "pending" && "border-[#2A3241] bg-[#1A1F2B]/80"
        )}
      >
        {/* Active pulse ring */}
        {node.status === "active" && (
          <div className="absolute inset-0 rounded-full border-2 border-[#0095FF]/50 animate-ping opacity-40" />
        )}

        {/* Gear SVG */}
        <div className="relative z-10">
          <GearIcon status={node.status} size={36} />
        </div>

        {/* Icon overlay (centered in gear hub) */}
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <span className="text-lg">{node.icon}</span>
        </div>

        {/* Checkmark for complete */}
        {node.status === "complete" && (
          <div className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#2EE6C9] flex items-center justify-center z-30 shadow-lg">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0B0E11" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>

      <span
        className={cn(
          "mt-2 text-xs font-medium transition-colors",
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

// Connecting line with animated flow based on completion
function GearConnection({ from, to, index }: { from: Node; to: Node; index: number }) {
  const isComplete = from.status === "complete" && to.status === "complete";
  const isActive = from.status === "complete" && to.status === "active";
  const isPending = !isComplete && !isActive;

  return (
    <div className="relative flex-1 h-20 flex items-center mx-0.5 min-w-[24px]">
      {/* Connection line with gradient */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`lineGrad-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2EE6C9" />
            <stop offset="50%" stopColor="#0095FF" />
            <stop offset="100%" stopColor="#2EE6C9" />
          </linearGradient>
          <linearGradient id={`lineActive-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2EE6C9" />
            <stop offset="100%" stopColor="#0095FF" />
          </linearGradient>
        </defs>
        {/* Base track */}
        <line
          x1="0"
          y1="50"
          x2="100"
          y2="50"
          stroke={isPending ? "#2A3241" : isComplete ? `url(#lineGrad-${index})` : `url(#lineActive-${index})`}
          strokeWidth="3"
          strokeLinecap="round"
          className="transition-all duration-500"
        />
        {/* Glow for active/complete */}
        {(isActive || isComplete) && (
          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            stroke={isComplete ? "#2EE6C9" : "#0095FF"}
            strokeWidth="6"
            strokeLinecap="round"
            opacity="0.2"
            className="transition-all duration-500"
          />
        )}
      </svg>

      {/* Animated flow particles */}
      {(isActive || isComplete) && (
        <div className="absolute inset-0 overflow-hidden">
          {[0, 0.25, 0.5, 0.75].map((delay) => (
            <div
              key={delay}
              className="absolute w-2 h-2 rounded-full bg-[#2EE6C9] shadow-[0_0_8px_#2EE6C9]"
              style={{
                top: "50%",
                marginTop: -4,
                animation: "gearFlow 1.2s ease-in-out infinite",
                animationDelay: `${delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Small gear teeth accent on the line */}
      {isComplete && (
        <div
          className="absolute top-1/2 left-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 opacity-60"
          style={{ animation: "gearSpin 1.5s linear infinite" }}
        >
          <svg viewBox="0 0 12 12" className="w-full h-full">
            <path
              d="M6 1 L7 3 L9 3 L7.5 4.5 L8 6 L6 5 L4 6 L4.5 4.5 L3 3 L5 3 Z"
              fill="#2EE6C9"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

function formatCost(cents: number): string {
  if (cents < 100) return `${cents}¢`;
  return `$${(cents / 100).toFixed(2)}`;
}

export function ManufacturingPanel({ clips, batch }: ManufacturingPanelProps) {
  const outputType = (batch as any).output_type || "video";
  const estimatedCost = batch.estimated_cost || 0;
  const nodes = useMemo(() => getNodes(clips, outputType), [clips, outputType]);
  const readyCount = clips.filter((c) => c.status === "ready").length;
  const totalCount = clips.length;
  const allDone = readyCount === totalCount && totalCount > 0;
  const activeNode = nodes.find((n) => n.status === "active");

  return (
    <div className="bg-[#0B0E11] border border-[#1C2230] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#1C2230] flex items-center justify-between">
        <div className="flex items-center gap-3">
          {allDone ? (
            <div className="w-10 h-10 rounded-xl bg-[#2EE6C9]/20 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2EE6C9" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-[#0095FF]/10 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-[#0095FF] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-white">
              {allDone ? "Complete" : activeNode?.label || "Processing"}
            </h3>
            <p className="text-xs text-[#6B7A8F]">
              {allDone ? `${readyCount} ${outputType}s ready` : `Step ${nodes.filter((n) => n.status === "complete").length} of ${nodes.length}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-white">{readyCount}</span>
            <span className="text-sm text-[#4B5563]">/{totalCount}</span>
          </div>
          {estimatedCost > 0 && (
            <p className="text-xs text-[#2EE6C9] font-medium">{formatCost(estimatedCost)}</p>
          )}
        </div>
      </div>

      {/* Gear assembly */}
      <div className="p-6 overflow-x-auto">
        <div className="flex items-center justify-center min-w-max gap-0">
          {nodes.map((node, index) => (
            <div key={node.id} className="flex items-center">
              <GearNode node={node} index={index} />
              {index < nodes.length - 1 && (
                <GearConnection from={node} to={nodes[index + 1]} index={index} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Prompt */}
      <div className="px-5 py-3 border-t border-[#1C2230] bg-[#0F1318]">
        <p className="text-xs text-[#6B7A8F] truncate">
          <span className="text-[#4B5563]">Prompt:</span> {batch.intent_text}
        </p>
      </div>

    </div>
  );
}
