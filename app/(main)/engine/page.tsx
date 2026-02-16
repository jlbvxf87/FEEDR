"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabaseBrowser";
import { cn } from "@/lib/utils";
import type { Batch, Clip, Job } from "@/lib/types";

// ─── Shared progress calculation ──────────────────────────────
// Single source of truth used by BOTH the card and the detail panel.
// For video batches the pipeline is:
//   researching (0-15%) → scripting (15-35%) → vo (35-55%) → rendering (55-80%) → assembling (80-95%) → ready (100%)
// For image batches:
//   researching (0-20%) → generating (20-80%) → ready (100%)

const VIDEO_STAGE_WEIGHT: Record<string, number> = {
  planned: 0,
  scripting: 15,
  vo: 35,
  rendering: 55,
  assembling: 80,
  ready: 100,
  failed: 0,
};

const IMAGE_STAGE_WEIGHT: Record<string, number> = {
  planned: 0,
  scripting: 20,
  generating: 60,
  ready: 100,
  failed: 0,
};

function calculateProgress(
  batch: Batch,
  clips: Clip[],
  jobs: Job[],
): number {
  // Done or failed → pin at 100 or 0
  if (batch.status === "done") return 100;
  if (batch.status === "failed") return 0;

  // Researching phase (no clips yet or batch is researching)
  if (batch.status === "researching" || clips.length === 0) {
    // If researching with no clips, estimate from elapsed time
    const elapsed = (Date.now() - new Date(batch.created_at).getTime()) / 1000;
    // Research typically takes ~45s, map to 0-15%
    return Math.min(14, Math.round((elapsed / 45) * 14));
  }

  const isImage = batch.output_type === "image";
  const weights = isImage ? IMAGE_STAGE_WEIGHT : VIDEO_STAGE_WEIGHT;

  if (clips.length === 0) return 0;

  const totalWeight = clips.reduce((sum, clip) => {
    return sum + (weights[clip.status] ?? 0);
  }, 0);

  return Math.round(totalWeight / clips.length);
}

// ─── Status helpers ──────────────────────────────────────────

type BatchPhase = "queued" | "researching" | "running" | "done" | "failed";

function getPhaseLabel(batch: Batch, clips: Clip[]): string {
  if (batch.status === "done") return "done";
  if (batch.status === "failed") return "failed";
  if (batch.status === "queued") return "queued";
  if (batch.status === "researching") return "researching";

  // Running → derive from clips
  if (clips.length === 0) return "preparing";

  const statuses = clips.map((c) => c.status);
  if (statuses.some((s) => s === "assembling")) return "assembling";
  if (statuses.some((s) => s === "rendering")) return "rendering";
  if (statuses.some((s) => s === "generating")) return "generating";
  if (statuses.some((s) => s === "vo")) return "voice synthesis";
  if (statuses.some((s) => s === "scripting")) return "scripting";
  return "processing";
}

function getActiveStage(batch: Batch, clips: Clip[]): string {
  if (batch.status === "done") return "complete";
  if (batch.status === "failed") return "failed";
  if (batch.status === "queued") return "budget_check";
  if (batch.status === "researching") return "brief_builder";

  if (clips.length === 0) return "brief_builder";
  const statuses = clips.map((c) => c.status);
  if (statuses.some((s) => s === "assembling")) return "assembly";
  if (statuses.some((s) => s === "rendering" || s === "generating")) return "provider_submit";
  if (statuses.some((s) => s === "vo")) return "voice_synthesis";
  if (statuses.some((s) => s === "scripting")) return "script_gen";
  if (statuses.every((s) => s === "ready")) return "complete";
  return "processing";
}

function getStageLabel(stage: string): string {
  const labels: Record<string, string> = {
    budget_check: "Checking budget...",
    brief_builder: "Building brief...",
    script_gen: "Writing scripts...",
    voice_synthesis: "Generating voiceover...",
    provider_submit: "Generating video...",
    assembly: "Assembling final...",
    processing: "Processing...",
    complete: "Complete!",
    failed: "Failed",
  };
  return labels[stage] ?? "Processing...";
}

// ─── Badge colors ────────────────────────────────────────────

function getBadgeStyles(stage: string): string {
  switch (stage) {
    case "budget_check":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "brief_builder":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "script_gen":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "voice_synthesis":
      return "bg-pink-500/20 text-pink-400 border-pink-500/30";
    case "provider_submit":
      return "bg-indigo-500/20 text-indigo-400 border-indigo-500/30";
    case "assembly":
      return "bg-teal-500/20 text-teal-400 border-teal-500/30";
    case "complete":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "failed":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

function getCardBadgeLabel(batch: Batch, clips: Clip[]): string {
  if (batch.status === "done") return "done";
  if (batch.status === "failed") return "failed";
  const stage = getActiveStage(batch, clips);
  return stage.replace(/_/g, " ");
}

// ─── Time formatting ─────────────────────────────────────────

function formatTime(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

// ─── Estimated remaining time ────────────────────────────────

function estimateRemaining(progress: number, elapsedSec: number): number {
  if (progress <= 0 || progress >= 100) return 0;
  const rate = progress / elapsedSec;
  return Math.round((100 - progress) / rate);
}

// ─── Provider name helper ────────────────────────────────────

function getProviderName(batch: Batch): string {
  const mode = batch.quality_mode || "good";
  if (batch.output_type === "image") {
    if (mode === "fast") return "dall-e-2";
    if (mode === "better") return "dall-e-3-hd";
    return "dall-e-3";
  }
  return "seedance";
}

function getVideoDuration(batch: Batch): string {
  // Default video durations based on quality
  if (batch.output_type === "image") return "—";
  const mode = batch.quality_mode || "good";
  if (mode === "fast") return "5s";
  if (mode === "better") return "15s";
  return "10s";
}

// ─── Types ───────────────────────────────────────────────────

interface BatchWithMeta extends Batch {
  clips: Clip[];
  jobs: Job[];
  estimated_cost?: number;
}

// ─── Main Page Component ─────────────────────────────────────

export default function EnginePage() {
  const supabase = createClient();
  const [batches, setBatches] = useState<BatchWithMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Tick every second to refresh elapsed times
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Load batches with clips and jobs
  const loadBatches = useCallback(async () => {
    const { data: batchRows } = await supabase
      .from("batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!batchRows || batchRows.length === 0) {
      setBatches([]);
      return;
    }

    const batchIds = batchRows.map((b) => b.id);

    const [{ data: clipsData }, { data: jobsData }] = await Promise.all([
      supabase
        .from("clips")
        .select("*")
        .in("batch_id", batchIds)
        .order("variant_id"),
      supabase
        .from("jobs")
        .select("*")
        .in("batch_id", batchIds)
        .order("created_at"),
    ]);

    const clipsMap = new Map<string, Clip[]>();
    const jobsMap = new Map<string, Job[]>();

    (clipsData || []).forEach((c: Clip) => {
      const arr = clipsMap.get(c.batch_id) || [];
      arr.push(c);
      clipsMap.set(c.batch_id, arr);
    });

    (jobsData || []).forEach((j: Job) => {
      const arr = jobsMap.get(j.batch_id) || [];
      arr.push(j);
      jobsMap.set(j.batch_id, arr);
    });

    const enriched: BatchWithMeta[] = batchRows.map((b) => ({
      ...(b as Batch),
      clips: clipsMap.get(b.id) || [],
      jobs: jobsMap.get(b.id) || [],
    }));

    setBatches(enriched);

    // Auto-select first if nothing selected
    if (!selectedId && enriched.length > 0) {
      setSelectedId(enriched[0].id);
    }
  }, [selectedId]);

  // Initial load + poll
  useEffect(() => {
    loadBatches();
    const interval = setInterval(loadBatches, 3000);
    return () => clearInterval(interval);
  }, [loadBatches]);

  // Stats
  const stats = useMemo(() => {
    const total = batches.length;
    const active = batches.filter(
      (b) => b.status === "running" || b.status === "researching" || b.status === "queued"
    ).length;
    const done = batches.filter((b) => b.status === "done").length;
    const queued = batches.filter((b) => b.status === "queued").length;
    return { total, active, done, queued };
  }, [batches]);

  const selected = batches.find((b) => b.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-[#0B0E11] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0B0E11]/95 backdrop-blur border-b border-[#1C2230]">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#2EE6C9] flex items-center justify-center">
                <span className="text-[#0B0E11] text-xs font-bold">T2V</span>
              </div>
              <span className="text-lg font-semibold">Engine</span>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm">
              <span>
                <span className="text-[#6B7A8F]">TOTAL</span>{" "}
                <span className="font-semibold">{stats.total}</span>
              </span>
              <span>
                <span className="text-[#6B7A8F]">ACTIVE</span>{" "}
                <span className="font-semibold text-blue-400">{stats.active}</span>
              </span>
              <span>
                <span className="text-[#6B7A8F]">DONE</span>{" "}
                <span className="font-semibold text-green-400">{stats.done}</span>
              </span>
              <span>
                <span className="text-[#6B7A8F]">QUEUE</span>{" "}
                <span className="font-semibold text-yellow-400">{stats.queued}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-[#6B7A8F]">Admin</span>
            <Link
              href="/"
              className="px-4 py-2 rounded-lg bg-white text-[#0B0E11] text-sm font-semibold hover:bg-gray-100 transition-colors"
            >
              + New Video
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-[1600px] mx-auto px-4 py-6 flex gap-6">
        {/* Cards grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min">
          {batches.map((batch) => (
            <BatchCard
              key={batch.id}
              batch={batch}
              isSelected={batch.id === selectedId}
              onSelect={() => setSelectedId(batch.id)}
              tick={tick}
            />
          ))}
          {batches.length === 0 && (
            <div className="col-span-full text-center py-20 text-[#4B5563]">
              No batches yet. Create a video to get started.
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <DetailPanel batch={selected} tick={tick} />
        )}
      </div>
    </div>
  );
}

// ─── Batch Card ──────────────────────────────────────────────

function BatchCard({
  batch,
  isSelected,
  onSelect,
  tick,
}: {
  batch: BatchWithMeta;
  isSelected: boolean;
  onSelect: () => void;
  tick: number;
}) {
  // Shared progress — SAME function as detail panel
  const progress = calculateProgress(batch, batch.clips, batch.jobs);
  const stage = getActiveStage(batch, batch.clips);
  const badgeLabel = getCardBadgeLabel(batch, batch.clips);
  const isActive = batch.status === "running" || batch.status === "researching";
  const isDone = batch.status === "done";
  const isFailed = batch.status === "failed";

  const elapsed = Math.floor(
    (Date.now() - new Date(batch.created_at).getTime()) / 1000
  );
  const phaseLabel = getPhaseLabel(batch, batch.clips);
  const provider = getProviderName(batch);
  const duration = getVideoDuration(batch);

  return (
    <button
      onClick={onSelect}
      className={cn(
        "text-left w-full p-4 rounded-xl border transition-all",
        "bg-[#12161D] hover:bg-[#161B25]",
        isSelected
          ? "border-[#2EE6C9]/50 ring-1 ring-[#2EE6C9]/20"
          : "border-[#1C2230]"
      )}
    >
      {/* Top row: badge + provider */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={cn(
            "px-2.5 py-1 rounded text-[11px] font-mono font-medium border",
            getBadgeStyles(stage)
          )}
        >
          {badgeLabel}
        </span>
        <span className="text-xs text-[#4B5563]">
          {provider} &middot; {duration}
        </span>
      </div>

      {/* Prompt text — allow wrapping, no truncation */}
      <p className="text-sm text-white leading-relaxed mb-3 break-words">
        {batch.intent_text}
      </p>

      {/* Status line — no truncation, wraps naturally */}
      {isActive && (
        <p className="text-xs text-[#6B7A8F] mb-1 break-words">
          {getStageLabel(stage)} {formatTime(elapsed)}
        </p>
      )}

      {/* Progress bar + percentage (only for active batches) */}
      {isActive && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-1 bg-[#1C2230] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#A855F7] via-[#0095FF] to-[#2EE6C9] rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-[#6B7A8F] tabular-nums w-8 text-right">
            {progress}%
          </span>
        </div>
      )}

      {/* Done indicator */}
      {isDone && (
        <div className="flex items-center gap-1.5 mb-2">
          <div className="h-1 flex-1 bg-[#2EE6C9] rounded-full" />
          <span className="text-xs text-[#2EE6C9]">100%</span>
        </div>
      )}

      {/* Failed indicator */}
      {isFailed && (
        <p className="text-xs text-red-400 mb-2">
          {batch.error || "Generation failed"}
        </p>
      )}

      {/* Date */}
      <p className="text-[11px] text-[#4B5563]">
        {formatDate(batch.created_at)} &middot;
      </p>
    </button>
  );
}

// ─── Detail Panel ────────────────────────────────────────────

function DetailPanel({
  batch,
  tick,
}: {
  batch: BatchWithMeta;
  tick: number;
}) {
  // Shared progress — SAME function as the card
  const progress = calculateProgress(batch, batch.clips, batch.jobs);
  const stage = getActiveStage(batch, batch.clips);
  const isActive = batch.status === "running" || batch.status === "researching";
  const isDone = batch.status === "done";

  const elapsed = Math.floor(
    (Date.now() - new Date(batch.created_at).getTime()) / 1000
  );
  const remaining = isActive ? estimateRemaining(progress, elapsed) : 0;

  const provider = getProviderName(batch);
  const duration = getVideoDuration(batch);

  // Build timeline from jobs
  const timeline = useMemo(() => {
    const events: { label: string; sublabel: string; time: string }[] = [];

    // Add batch creation
    events.push({
      label: "state_transition",
      sublabel: "budget_check",
      time: formatTimestamp(batch.created_at),
    });

    // Add job state transitions
    batch.jobs.forEach((job) => {
      if (job.status === "running" || job.status === "done" || job.status === "failed") {
        events.push({
          label: "state_transition",
          sublabel: job.type + (job.status === "done" ? " complete" : job.status === "failed" ? " failed" : ""),
          time: formatTimestamp(job.updated_at),
        });
      }
    });

    return events;
  }, [batch.jobs, batch.created_at]);

  return (
    <div className="w-[400px] shrink-0 bg-[#12161D] border border-[#1C2230] rounded-xl overflow-hidden self-start sticky top-20">
      {/* Stage badge */}
      <div className="px-5 pt-4 pb-3">
        <span
          className={cn(
            "px-2.5 py-1 rounded text-[11px] font-mono font-medium border",
            getBadgeStyles(stage)
          )}
        >
          {stage}
        </span>
      </div>

      {/* Progress section */}
      <div className="px-5 pb-4">
        <div className="bg-[#0B0E11] rounded-lg p-4 border border-[#1C2230]">
          <p className="text-sm text-white font-medium mb-2">
            {isDone ? "Complete!" : getStageLabel(stage)}
          </p>

          {/* Elapsed + remaining */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#6B7A8F]">
              {formatTime(elapsed)} elapsed
            </span>
            {isActive && remaining > 0 && (
              <span className="text-xs text-[#F59E0B]">
                ~{formatTime(remaining)} remaining
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-[#1C2230] rounded-full overflow-hidden mb-1">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                isDone
                  ? "bg-[#2EE6C9]"
                  : "bg-gradient-to-r from-[#A855F7] via-[#0095FF] to-[#2EE6C9]"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-[#6B7A8F]">{progress}% complete</p>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[#1C2230]" />

      {/* Metadata */}
      <div className="px-5 py-4 space-y-4">
        {/* Prompt */}
        <div>
          <p className="text-[10px] text-[#6B7A8F] uppercase tracking-wider mb-1">
            Prompt
          </p>
          <p className="text-sm text-white leading-relaxed break-words">
            {batch.intent_text}
          </p>
        </div>

        {/* Provider + Duration */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-[#6B7A8F] uppercase tracking-wider mb-1">
              Provider
            </p>
            <p className="text-sm text-white font-medium">{provider}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#6B7A8F] uppercase tracking-wider mb-1">
              Duration
            </p>
            <p className="text-sm text-white font-medium">{duration}</p>
          </div>
        </div>

        {/* Mode + Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-[#6B7A8F] uppercase tracking-wider mb-1">
              Mode
            </p>
            <p className="text-sm text-white font-medium">
              {batch.output_type === "image" ? "T2I" : "T2V"}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[#6B7A8F] uppercase tracking-wider mb-1">
              Priority
            </p>
            <p className="text-sm text-white font-medium">normal</p>
          </div>
        </div>

        {/* Retries */}
        <div>
          <p className="text-[10px] text-[#6B7A8F] uppercase tracking-wider mb-1">
            Retries
          </p>
          <p className="text-sm text-white font-medium">
            {Math.max(0, ...batch.jobs.map((j) => j.attempts - 1), 0)}
          </p>
        </div>
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <>
          <div className="border-t border-[#1C2230]" />
          <div className="px-5 py-4">
            <p className="text-[10px] text-[#6B7A8F] uppercase tracking-wider mb-3">
              Timeline
            </p>
            <div className="space-y-3">
              {timeline.map((event, i) => (
                <div key={i} className="flex items-start gap-3">
                  {/* Timeline dot + line */}
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-[#0095FF] mt-1.5" />
                    {i < timeline.length - 1 && (
                      <div className="w-px h-6 bg-[#1C2230] mt-1" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-medium">
                      {event.label}
                    </p>
                    <p className="text-[11px] text-[#4B5563]">
                      {event.sublabel} &middot; {event.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
