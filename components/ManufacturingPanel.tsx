"use client";

import { cn } from "@/lib/utils";
import type { Clip, Batch } from "@/lib/types";
import { useEffect, useState, useMemo } from "react";

interface ManufacturingPanelProps {
  clips: Clip[];
  batch: Batch;
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

// Animated particle that flows along the connection
function FlowParticle({ delay, duration }: { delay: number; duration: number }) {
  return (
    <div
      className="absolute w-2 h-2 rounded-full bg-[#2EE6C9] shadow-[0_0_10px_#2EE6C9]"
      style={{
        animation: `flowRight ${duration}s ease-in-out infinite`,
        animationDelay: `${delay}s`,
      }}
    />
  );
}

// Single workflow node
function WorkflowNode({ node, index }: { node: Node; index: number }) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (node.status === "active") {
      const interval = setInterval(() => setPulse(p => !p), 1000);
      return () => clearInterval(interval);
    }
  }, [node.status]);

  return (
    <div
      className="relative flex flex-col items-center"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {/* Node card */}
      <div
        className={cn(
          "relative w-16 h-16 rounded-2xl flex items-center justify-center text-2xl transition-all duration-500",
          "border-2 backdrop-blur-sm",
          node.status === "complete" && "bg-[#2EE6C9]/20 border-[#2EE6C9] shadow-[0_0_20px_rgba(46,230,201,0.3)]",
          node.status === "active" && "bg-[#0095FF]/20 border-[#0095FF] shadow-[0_0_25px_rgba(0,149,255,0.4)]",
          node.status === "pending" && "bg-[#1A1F2B]/80 border-[#2A3241]"
        )}
      >
        {/* Pulse ring for active */}
        {node.status === "active" && (
          <>
            <div className="absolute inset-0 rounded-2xl border-2 border-[#0095FF] animate-ping opacity-30" />
            <div className={cn(
              "absolute inset-0 rounded-2xl bg-[#0095FF]/10 transition-opacity duration-500",
              pulse ? "opacity-100" : "opacity-0"
            )} />
          </>
        )}
        
        {/* Checkmark overlay for complete */}
        {node.status === "complete" && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#2EE6C9] flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0B0E11" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}

        <span className={cn(
          "transition-transform duration-300",
          node.status === "active" && "animate-bounce"
        )}>
          {node.icon}
        </span>
      </div>

      {/* Label */}
      <span className={cn(
        "mt-2 text-xs font-medium transition-colors",
        node.status === "complete" && "text-[#2EE6C9]",
        node.status === "active" && "text-white",
        node.status === "pending" && "text-[#4B5563]"
      )}>
        {node.label}
      </span>
    </div>
  );
}

// Connection line between nodes
function Connection({ from, to }: { from: Node; to: Node }) {
  const isActive = from.status === "complete" && to.status === "active";
  const isComplete = from.status === "complete" && to.status === "complete";

  return (
    <div className="relative flex-1 h-16 flex items-center mx-1">
      {/* Base line */}
      <div className={cn(
        "w-full h-0.5 rounded-full transition-colors duration-500",
        isComplete && "bg-[#2EE6C9]",
        isActive && "bg-gradient-to-r from-[#2EE6C9] to-[#0095FF]",
        !isComplete && !isActive && "bg-[#2A3241]"
      )} />

      {/* Animated particles */}
      {isActive && (
        <div className="absolute inset-0 overflow-hidden">
          <FlowParticle delay={0} duration={1} />
          <FlowParticle delay={0.3} duration={1} />
          <FlowParticle delay={0.6} duration={1} />
        </div>
      )}

      {/* Arrow */}
      <div className={cn(
        "absolute right-0 w-0 h-0 border-t-[4px] border-b-[4px] border-l-[6px] border-t-transparent border-b-transparent transition-colors duration-500",
        isComplete && "border-l-[#2EE6C9]",
        isActive && "border-l-[#0095FF]",
        !isComplete && !isActive && "border-l-[#2A3241]"
      )} />
    </div>
  );
}

export function ManufacturingPanel({ clips, batch }: ManufacturingPanelProps) {
  const outputType = (batch as any).output_type || "video";
  const nodes = useMemo(() => getNodes(clips, outputType), [clips, outputType]);
  const readyCount = clips.filter((c) => c.status === "ready").length;
  const totalCount = clips.length;
  const allDone = readyCount === totalCount && totalCount > 0;
  const activeNode = nodes.find(n => n.status === "active");

  return (
    <div className="bg-[#0B0E11] border border-[#1C2230] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#1C2230] flex items-center justify-between">
        <div className="flex items-center gap-3">
          {allDone ? (
            <div className="w-8 h-8 rounded-full bg-[#2EE6C9]/20 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2EE6C9" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#0095FF]/20 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-[#0095FF] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-white">
              {allDone ? "Complete" : activeNode?.label || "Processing"}
            </h3>
            <p className="text-xs text-[#6B7A8F]">
              {allDone ? `${readyCount} ${outputType}s ready` : `Step ${nodes.filter(n => n.status === "complete").length} of ${nodes.length}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-white">{readyCount}</span>
          <span className="text-lg text-[#4B5563]">/{totalCount}</span>
        </div>
      </div>

      {/* Workflow Grid */}
      <div className="p-6 overflow-x-auto">
        <div className="flex items-center justify-center min-w-max gap-1">
          {nodes.map((node, index) => (
            <div key={node.id} className="flex items-center">
              <WorkflowNode node={node} index={index} />
              {index < nodes.length - 1 && (
                <Connection from={node} to={nodes[index + 1]} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Prompt display */}
      <div className="px-5 py-3 border-t border-[#1C2230] bg-[#0F1318]">
        <p className="text-xs text-[#6B7A8F] truncate">
          <span className="text-[#4B5563]">Prompt:</span> {batch.intent_text}
        </p>
      </div>

      {/* Output preview */}
      {readyCount > 0 && (
        <div className="px-5 py-4 border-t border-[#1C2230]">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {clips.filter(c => c.status === "ready").slice(0, 6).map((clip) => (
              <div
                key={clip.id}
                className="flex-shrink-0 w-14 h-20 rounded-xl overflow-hidden bg-[#1A1F2B] border border-[#2EE6C9]/30 relative group"
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
                  <div className="w-full h-full flex items-center justify-center text-[#2EE6C9]">
                    ✓
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes flowRight {
          0% { left: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
