"use client";

import { useState, useEffect, useCallback, Suspense, useMemo, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import type { Preset, Batch, Clip, PresetKey, BatchMode, BatchSize, OutputType, BatchStatus, ClipStatus } from "@/lib/types";
import { ImagePack, IMAGE_PACKS, generateImagePrompts } from "@/lib/imagePresets";
import { QualityMode, estimateBatchCost, formatCost, analyzeComplexity, QUALITY_TIERS } from "@/lib/costs";
import { ImagePackSelector } from "@/components/ImagePackSelector";
import { Header } from "@/components/nav/Header";
import { PresetGrid } from "@/components/PresetGrid";
import { ResultsGrid } from "@/components/ResultsGrid";
import { ManufacturingPanel } from "@/components/ManufacturingPanel";
import { VideoModalFeed } from "@/components/VideoModalFeed";
import { cn } from "@/lib/utils";

function FeedPageContent() {
  const searchParams = useSearchParams();
  const isDevMode = searchParams.get("dev") === "1";

  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>("AUTO");
  const [currentBatch, setCurrentBatch] = useState<Batch | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialIndex, setModalInitialIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Input state
  const [intentText, setIntentText] = useState("");
  const [showPresets, setShowPresets] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const manufacturingRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "56px"; // Reset to min height
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`; // Max 200px
    }
  }, []);
  
  // Output type & batch size
  const [outputType, setOutputType] = useState<OutputType>("video");
  const [videoBatchSize, setVideoBatchSize] = useState<2 | 4 | 6>(4);
  const [imageBatchSize, setImageBatchSize] = useState<2 | 4 | 8>(4);
  const [imagePack, setImagePack] = useState<ImagePack>("auto");
  const [showImagePacks, setShowImagePacks] = useState(false);
  
  // Quality mode - user controls which models to use
  const [qualityMode, setQualityMode] = useState<QualityMode>("good");
  const [videoService, setVideoService] = useState<"sora" | "kling">("kling");
  const [userId, setUserId] = useState<string | null>(null);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  
  // Cost tracking
  const [totalSpent, setTotalSpent] = useState(0);
  const [sessionCost, setSessionCost] = useState(0);
  const [balanceCents, setBalanceCents] = useState<number | null>(null);

  const supabase = createClient();

  const extractFunctionError = (err: unknown): string | null => {
    if (!err || typeof err !== "object") return null;
    const anyErr = err as any;
    // Log full error for debugging
    console.error("Edge function error details:", JSON.stringify(anyErr, null, 2));
    // Try context.body (Supabase JS client wraps errors here)
    const context = anyErr?.context;
    const body = context?.body;
    if (body) {
      try {
        const parsed = typeof body === "string" ? JSON.parse(body) : body;
        if (typeof parsed?.error === "string") return parsed.error;
        if (typeof parsed?.message === "string") return parsed.message;
      } catch {
        if (typeof body === "string") return body;
      }
    }
    // Try direct message property
    if (typeof anyErr?.message === "string" && anyErr.message !== "Edge Function returned a non-2xx status code") {
      return anyErr.message;
    }
    return null;
  };

  // Calculate estimated cost based on current settings
  const estimatedCost = useMemo(() => {
    const batchSize = outputType === "image" ? imageBatchSize : videoBatchSize;
    const estimate = estimateBatchCost(qualityMode, outputType, batchSize, videoService);
    return {
      ...estimate,
      mode: qualityMode,
      modeLabel: QUALITY_TIERS[qualityMode].label,
      batchSize,
    };
  }, [qualityMode, outputType, videoBatchSize, imageBatchSize]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: presetsData, error: presetsError } = await supabase
          .from("presets")
          .select("*")
          .eq("is_active", true)
          .order("key");

        if (presetsError) throw presetsError;
        setPresets((presetsData || []) as Preset[]);

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user?.id) return;
        setUserId(user.id);

        // Load user preferences (video service)
        const { data: prefs, error: prefsError } = await supabase
          .from("user_preferences")
          .select("default_video_service")
          .eq("user_id", user.id)
          .single();

        if (!prefsError && prefs?.default_video_service) {
          const svc = prefs.default_video_service === "sora" ? "sora" : "kling";
          setVideoService(svc);
        }
        setPrefsLoaded(true);

        // Load total spent (sum of all batch costs)
        const { data: batchesData } = await supabase
          .from("batches")
          .select("user_charge_cents")
          .eq("user_id", user.id)
          .not("user_charge_cents", "is", null);

        if (batchesData) {
          const total = batchesData.reduce((sum, b) => sum + (b.user_charge_cents || 0), 0);
          setTotalSpent(total);
        }

        // Load credit balance
        const { data: creditsData } = await supabase
          .from("user_credits")
          .select("balance_cents")
          .single();

        if (creditsData) {
          setBalanceCents(creditsData.balance_cents);
        }

        // Load latest batch
        const { data: batchData } = await supabase
          .from("batches")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (batchData) {
          setCurrentBatch(batchData as Batch);
          const { data: clipsData } = await supabase
            .from("clips")
            .select("*")
            .eq("batch_id", (batchData as Batch).id)
            .order("variant_id");

          setClips((clipsData || []) as Clip[]);
        }
      } catch (err) {
        console.error("Error loading data:", err);
      }
    };

    loadData();
  }, []);

  // Persist video service preference
  useEffect(() => {
    if (!userId || !prefsLoaded) return;
    const upsertPref = async () => {
      await supabase
        .from("user_preferences")
        .upsert(
          { user_id: userId, default_video_service: videoService, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
    };
    upsertPref();
  }, [userId, prefsLoaded, videoService]);

  // Poll for updates and trigger worker while batch is running
  useEffect(() => {
    // Poll while batch is in any active state (researching or running)
    if (!currentBatch || (currentBatch.status !== "running" && currentBatch.status !== "researching")) return;

    const pollInterval = setInterval(async () => {
      try {
        // Trigger worker to process queued jobs in parallel
        // Fire 3 concurrent invocations so TTS + Video can run simultaneously
        const workerCalls = Array.from({ length: 3 }, () =>
          supabase.functions.invoke("worker", { body: { action: "run-once" } }).catch(() => ({ data: null }))
        );
        await Promise.all(workerCalls);

        const { data: batchData } = await supabase
          .from("batches")
          .select("*")
          .eq("id", currentBatch.id)
          .single();

        const batch = batchData as Batch;
        setCurrentBatch(batch);

        const { data: clipsData } = await supabase
          .from("clips")
          .select("*")
          .eq("batch_id", currentBatch.id)
          .order("variant_id");

        setClips((clipsData || []) as Clip[]);

        if (batch.status === "done" || batch.status === "failed") {
          setIsGenerating(false);
          // Refresh balance to reflect any refunds for failed clips
          const { data: creditsData } = await supabase
            .from("user_credits")
            .select("balance_cents")
            .single();
          if (creditsData) {
            setBalanceCents(creditsData.balance_cents);
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [currentBatch?.id, currentBatch?.status]);

  const handleGenerate = useCallback(async () => {
    if (!intentText.trim() || isGenerating) return;
    
    setIsGenerating(true);
    setError(null);

    try {
      const mode: BatchMode = "hook_test";
      const batchSize = outputType === "image" ? imageBatchSize : videoBatchSize;
      
      const imagePrompts = outputType === "image" 
        ? generateImagePrompts(intentText.trim(), imagePack)
        : undefined;
      
      const { data, error } = await supabase.functions.invoke("generate-batch", {
        body: { 
          intent_text: intentText.trim(), 
          preset_key: selectedPreset, 
          mode, 
          batch_size: batchSize,
          output_type: outputType,
          image_pack: outputType === "image" ? imagePack : undefined,
          image_prompts: imagePrompts,
          quality_mode: estimatedCost.mode,
          estimated_cost: estimatedCost.totalCents,
          video_service: isDevMode && outputType === "video" ? videoService : undefined,
        },
      });

      if (error) {
        const detailed = extractFunctionError(error);
        // Check for insufficient credits error
        if (detailed?.includes("Insufficient credits") || error.message?.includes("Insufficient credits")) {
          throw new Error("Not enough credits. Add more to continue — you're only charged for successful outputs.");
        }
        throw new Error(detailed || error.message || "Edge function failed");
      }

      // Update session cost and balance (user was charged)
      setSessionCost(prev => prev + estimatedCost.totalCents);
      setTotalSpent(prev => prev + estimatedCost.totalCents);
      setBalanceCents(prev => prev !== null ? Math.max(0, prev - estimatedCost.totalCents) : null);

      const { data: batchData } = await supabase
        .from("batches")
        .select("*")
        .eq("id", data.batch_id)
        .single();

      setCurrentBatch(batchData as Batch);

      const { data: clipsData } = await supabase
        .from("clips")
        .select("*")
        .eq("batch_id", data.batch_id)
        .order("variant_id");

      setClips((clipsData || []) as Clip[]);
      
      // Scroll to manufacturing section after state updates
      setTimeout(() => {
        manufacturingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      console.error("Generate error:", err);
      setError(err instanceof Error ? err.message : "Something broke. Try again.");
      setIsGenerating(false);
    }
  }, [intentText, selectedPreset, outputType, imagePack, estimatedCost, isGenerating, videoService]);

  const handleToggleWinner = useCallback(async (clipId: string, winner: boolean) => {
    await supabase.from("clips").update({ winner }).eq("id", clipId);
    setClips((prev) => prev.map((c) => (c.id === clipId ? { ...c, winner } : c)));
  }, []);

  const handleToggleKilled = useCallback(async (clipId: string, killed: boolean) => {
    await supabase.from("clips").update({ killed }).eq("id", clipId);
    setClips((prev) => prev.map((c) => (c.id === clipId ? { ...c, killed } : c)));
  }, []);

  const handleCancel = useCallback(async () => {
    if (!currentBatch) return;
    try {
      // 1. Set batch status to cancelled
      await supabase
        .from("batches")
        .update({ status: "cancelled" as BatchStatus })
        .eq("id", currentBatch.id);

      // 2. Mark all non-ready clips as failed
      await supabase
        .from("clips")
        .update({ status: "failed" as ClipStatus, error: "Cancelled by user" })
        .eq("batch_id", currentBatch.id)
        .neq("status", "ready");

      // 3. Delete queued/running jobs
      await supabase
        .from("jobs")
        .delete()
        .eq("batch_id", currentBatch.id)
        .in("status", ["queued", "running"]);

      // 4. Refund credits
      await supabase.rpc("refund_batch", { p_batch_id: currentBatch.id });

      // 5. Refresh balance (refund applied)
      const { data: creditsData } = await supabase
        .from("user_credits")
        .select("balance_cents")
        .single();
      if (creditsData) {
        setBalanceCents(creditsData.balance_cents);
      }

      // 6. Update local state
      setIsGenerating(false);
      setCurrentBatch(prev => prev ? { ...prev, status: "cancelled" as BatchStatus } : null);

      // 7. Refresh clips
      const { data: clipsData } = await supabase
        .from("clips")
        .select("*")
        .eq("batch_id", currentBatch.id)
        .order("variant_id");
      setClips((clipsData || []) as Clip[]);
    } catch (err) {
      console.error("Cancel error:", err);
      setError("Failed to cancel batch. Try again.");
    }
  }, [currentBatch]);

  const handleClipClick = useCallback((index: number) => {
    const clip = clips[index];
    if (clip?.status === "ready") {
      setModalInitialIndex(index);
      setModalOpen(true);
    }
  }, [clips]);

  const isRunning = currentBatch?.status === "running" || currentBatch?.status === "researching";
  const showManufacturing = isRunning || isGenerating;
  const selectedPresetData = presets.find(p => p.key === selectedPreset);
  const presetLabel = selectedPresetData?.name || selectedPreset;

  return (
    <>
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* Error display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Input Section */}
        <section className="space-y-5">
          {/* Type Toggle */}
          <div className="flex justify-center">
            <div className="inline-flex bg-[#12161D] rounded-full p-1 border border-[#1C2230]">
              <button
                onClick={() => setOutputType("video")}
                disabled={isGenerating || isRunning}
                className={cn(
                  "px-6 py-2.5 rounded-full text-sm font-medium transition-all",
                  outputType === "video"
                    ? "bg-white text-[#0B0E11]"
                    : "text-[#6B7A8F] hover:text-white"
                )}
              >
                Video
              </button>
              <button
                onClick={() => setOutputType("image")}
                disabled={isGenerating || isRunning}
                className={cn(
                  "px-6 py-2.5 rounded-full text-sm font-medium transition-all",
                  outputType === "image"
                    ? "bg-white text-[#0B0E11]"
                    : "text-[#6B7A8F] hover:text-white"
                )}
              >
                Image
              </button>
            </div>
          </div>

          {/* Main Input - Auto-expanding */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={intentText}
              onChange={(e) => {
                setIntentText(e.target.value);
                adjustTextareaHeight();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder={outputType === "video" ? "Describe your video..." : "Describe your image..."}
              disabled={isGenerating || isRunning}
              rows={1}
              className={cn(
                "w-full min-h-[56px] py-4 px-5 pr-20 rounded-2xl resize-none",
                "bg-[#12161D] border border-[#1C2230]",
                "text-white text-base placeholder:text-[#4B5563] leading-relaxed",
                "focus:outline-none focus:border-[#2EE6C9]/50 focus:ring-1 focus:ring-[#2EE6C9]/20",
                "disabled:opacity-50 transition-all"
              )}
              style={{ height: "56px" }}
            />
            <button
              onClick={handleGenerate}
              disabled={!intentText.trim() || isGenerating || isRunning}
              className={cn(
                "absolute right-3 bottom-3",
                "h-10 px-5 rounded-xl font-semibold text-sm",
                "bg-[#2EE6C9] text-[#0B0E11]",
                "hover:bg-[#26D4B8]",
                "disabled:opacity-30 disabled:cursor-not-allowed",
                "transition-all"
              )}
            >
              {isGenerating || isRunning ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-[#0B0E11]/30 border-t-[#0B0E11] rounded-full animate-spin" />
                </span>
              ) : "Go"}
            </button>
          </div>

          {/* Options - Always visible */}
          <div className={cn(
            "space-y-4 p-4 rounded-xl",
            "bg-[#12161D] border border-[#1C2230]",
            (isGenerating || isRunning) && "opacity-50 pointer-events-none"
          )}>
            {/* Row 1: Quantity selector */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#6B7A8F]">
                {outputType === "video" ? "Videos" : "Images"}
              </span>
              {outputType === "video" ? (
                <div className="flex items-center bg-[#0B0E11] rounded-full p-1">
                  {([2, 4, 6] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => setVideoBatchSize(size)}
                      disabled={isGenerating || isRunning}
                      className={cn(
                        "w-10 h-8 rounded-full text-sm font-semibold transition-all",
                        videoBatchSize === size
                          ? "bg-[#2EE6C9] text-[#0B0E11]"
                          : "text-[#6B7A8F] hover:text-white"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center bg-[#0B0E11] rounded-full p-1">
                  {([2, 4, 8] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => setImageBatchSize(size)}
                      disabled={isGenerating || isRunning}
                      className={cn(
                        "w-10 h-8 rounded-full text-sm font-semibold transition-all",
                        imageBatchSize === size
                          ? "bg-[#2EE6C9] text-[#0B0E11]"
                          : "text-[#6B7A8F] hover:text-white"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Row 2: Quality selector */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#6B7A8F]">Quality</span>
              <div className="flex items-center bg-[#0B0E11] rounded-full p-1">
                {(["fast", "good", "better"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setQualityMode(mode)}
                    disabled={isGenerating || isRunning}
                    className={cn(
                      "px-4 h-8 rounded-full text-sm font-semibold transition-all",
                      qualityMode === mode
                        ? mode === "fast" 
                          ? "bg-[#F59E0B] text-[#0B0E11]"
                          : mode === "good"
                            ? "bg-[#2EE6C9] text-[#0B0E11]"
                            : "bg-[#A855F7] text-white"
                        : "text-[#6B7A8F] hover:text-white"
                    )}
                  >
                    {mode === "fast" ? "Fast" : mode === "good" ? "Good" : "Better"}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 2.5: Video service selector */}
            {outputType === "video" && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#6B7A8F]">Video Service</span>
                <div className="flex items-center bg-[#0B0E11] rounded-full p-1">
                  {(["sora", "kling"] as const).map((service) => (
                    <button
                      key={service}
                      onClick={() => setVideoService(service)}
                      disabled={isGenerating || isRunning}
                      className={cn(
                        "px-4 h-8 rounded-full text-sm font-semibold transition-all",
                        videoService === service
                          ? "bg-[#2EE6C9] text-[#0B0E11]"
                          : "text-[#6B7A8F] hover:text-white"
                      )}
                    >
                      {service === "sora" ? "Sora 2" : "Kling 2.6"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Row 3: Cost estimate with info tooltip */}
            <div className="flex items-center justify-between pt-2 border-t border-[#1C2230]">
              <div className="relative">
                <button
                  className="flex items-center gap-1.5 text-xs text-[#6B7A8F] hover:text-white transition-colors group"
                  onClick={(e) => {
                    const tooltip = e.currentTarget.nextElementSibling;
                    if (tooltip) {
                      tooltip.classList.toggle('opacity-0');
                      tooltip.classList.toggle('invisible');
                      tooltip.classList.toggle('opacity-100');
                      tooltip.classList.toggle('visible');
                    }
                  }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>View models</span>
                </button>
                {/* Tooltip - positioned to the right */}
                <div className="absolute left-0 bottom-full mb-2 px-4 py-3 bg-[#1C2230] rounded-xl opacity-0 invisible transition-all duration-200 z-50 shadow-xl border border-[#2A3441] min-w-[200px]">
                  <div className="text-[10px] text-[#6B7A8F] uppercase tracking-wider mb-2">Models Used</div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#6B7A8F]">Script</span>
                      <span className="text-white font-medium">
                        {qualityMode === "fast" ? "GPT-4o Mini" : qualityMode === "good" ? "Claude Haiku" : "Claude Sonnet"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7A8F]">Voice</span>
                      <span className="text-white font-medium">
                        {qualityMode === "fast" ? "Basic TTS" : qualityMode === "good" ? "ElevenLabs" : "ElevenLabs HD"}
                      </span>
                    </div>
                    {outputType === "video" && (
                      <div className="flex justify-between">
                        <span className="text-[#6B7A8F]">Video</span>
                        <span className="text-white font-medium">
                          {videoService === "kling" ? "Kling 2.6" : "Sora 2 Pro"}
                        </span>
                      </div>
                    )}
                    {outputType === "video" && (
                      <div className="text-[10px] text-[#6B7A8F]">
                        {videoService === "kling"
                          ? "Kling HD: 5s $0.28 / 10s $0.55 (no‑audio)"
                          : "Sora 2 Pro: 10s $1.00 / 15s $1.50"}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-2 border-t border-[#2A3441] text-[10px] text-[#4B5563]">
                    {outputType === "video" ? videoBatchSize : imageBatchSize} {outputType}{(outputType === "video" ? videoBatchSize : imageBatchSize) > 1 ? 's' : ''} × {qualityMode} tier
                  </div>
                  {/* Arrow */}
                  <div className="absolute top-full left-6 border-8 border-transparent border-t-[#1C2230]" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#4B5563]">
                  ~{outputType === "video" ? `${Math.ceil((45 + 10 + 12 + 270 + 15) / 60)}` : "2"} min
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[#6B7A8F]">Est.</span>
                  <span className="text-[#2EE6C9] font-bold text-lg">
                    {formatCost(estimatedCost.totalCents)}
                  </span>
                </div>
              </div>
            </div>

            {/* Per-service cost breakdown (per video) */}
            {outputType === "video" && (
              <div className="text-xs text-[#6B7A8F] space-y-1 pt-2 border-t border-[#1C2230]">
                <div className="text-[10px] uppercase tracking-wider text-[#4B5563]">
                  Per‑Video Breakdown (Base)
                </div>
                <div className="flex justify-between">
                  <span>Script</span>
                  <span>{formatCost(Math.round(estimatedCost.breakdown.script || 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Voice</span>
                  <span>{formatCost(Math.round(estimatedCost.breakdown.voice || 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Video</span>
                  <span>{formatCost(Math.round(estimatedCost.breakdown.video || 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Assembly</span>
                  <span>{formatCost(Math.round(estimatedCost.breakdown.assembly || 0))}</span>
                </div>
                {estimatedCost.breakdown.watermarkRemoval ? (
                  <div className="flex justify-between">
                    <span>Watermark</span>
                    <span>{formatCost(Math.round(estimatedCost.breakdown.watermarkRemoval || 0))}</span>
                  </div>
                ) : null}
              </div>
            )}

            {/* No charge for failures assurance */}
            <p className="text-[10px] text-[#4B5563] text-center pt-1">
              You&apos;re never charged for failed generations. Credits are automatically refunded.
            </p>
          </div>

          {/* Style Enhancement Section - Always Visible */}
          <div className="space-y-3">
            {/* Section Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[#6B7A8F] uppercase tracking-wider">
                  Style Enhancement
                </span>
                {selectedPreset !== "AUTO" && (
                  <span className="text-[10px] bg-[#2EE6C9]/10 text-[#2EE6C9] px-2 py-0.5 rounded-full">
                    Custom
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowPresets(!showPresets)}
                disabled={isGenerating || isRunning}
                className="text-xs text-[#2EE6C9] hover:text-[#2EE6C9]/80 transition-colors disabled:opacity-50"
              >
                {showPresets ? "Close" : "Change"}
              </button>
            </div>

            {/* Selected Style Card - Always Visible */}
            <button
              onClick={() => setShowPresets(!showPresets)}
              disabled={isGenerating || isRunning}
              className={cn(
                "w-full p-4 rounded-xl border transition-all",
                "bg-gradient-to-br from-[#12161D] to-[#0B0E11]",
                showPresets 
                  ? "border-[#2EE6C9]/50 ring-1 ring-[#2EE6C9]/20" 
                  : "border-[#1C2230] hover:border-[#2A3142]",
                "disabled:opacity-50"
              )}
            >
              <div className="flex items-center gap-4">
                {/* Style Icon/Preview */}
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center text-lg shrink-0",
                  "bg-gradient-to-br",
                  selectedPreset === "AUTO" ? "from-[#2EE6C9] to-[#1FB6FF]" :
                  selectedPreset === "FOUNDERS" ? "from-[#3B82F6] to-[#1D4ED8]" :
                  selectedPreset === "PODCAST" ? "from-[#8B5CF6] to-[#6D28D9]" :
                  selectedPreset === "DISCOVERY" ? "from-[#F59E0B] to-[#D97706]" :
                  selectedPreset === "CAMERA_PUT_DOWN" ? "from-[#EF4444] to-[#B91C1C]" :
                  selectedPreset === "SENSORY" ? "from-[#10B981] to-[#059669]" :
                  selectedPreset === "DELAYED_GRATIFICATION" ? "from-[#EC4899] to-[#BE185D]" :
                  "from-[#64748B] to-[#475569]"
                )}>
                  {selectedPreset === "AUTO" ? "✨" :
                   selectedPreset === "FOUNDERS" ? "💼" :
                   selectedPreset === "PODCAST" ? "🎙️" :
                   selectedPreset === "DISCOVERY" ? "🔍" :
                   selectedPreset === "CAMERA_PUT_DOWN" ? "📱" :
                   selectedPreset === "SENSORY" ? "🎧" :
                   selectedPreset === "DELAYED_GRATIFICATION" ? "⏳" : "🎬"}
                </div>

                {/* Style Info */}
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">
                      {selectedPreset === "AUTO" ? "Smart Auto" : presetLabel}
                    </span>
                    {selectedPreset === "AUTO" && (
                      <span className="text-[10px] bg-[#2EE6C9]/20 text-[#2EE6C9] px-1.5 py-0.5 rounded font-medium">
                        RECOMMENDED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#6B7A8F] mt-0.5">
                    {selectedPreset === "AUTO" 
                      ? "AI picks the best method for your prompt" 
                      : presets.find(p => p.key === selectedPreset)?.description || "Custom style"}
                  </p>
                </div>

                {/* Chevron */}
                <svg 
                  className={cn(
                    "w-5 h-5 text-[#6B7A8F] transition-transform",
                    showPresets && "rotate-180"
                  )} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Expanded Preset Grid */}
            {showPresets && (
              <div className="animate-in slide-in-from-top-2 fade-in duration-200">
                <div className="p-3 rounded-xl bg-[#12161D] border border-[#1C2230]">
                  <p className="text-xs text-[#6B7A8F] mb-3 text-center">
                    Choose a content method to enhance your video
                  </p>
                  <PresetGrid
                    presets={presets}
                    selectedKey={selectedPreset}
                    onSelect={(key) => {
                      setSelectedPreset(key);
                      setShowPresets(false);
                    }}
                    disabled={isGenerating || isRunning}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Workflow - prompt + manufacturing steps only; no video results on feed */}
        {showManufacturing && currentBatch && (
          <section ref={manufacturingRef} className="space-y-4 scroll-mt-4">
            <ManufacturingPanel
              clips={clips}
              batch={currentBatch}
              onCancel={handleCancel}
            />
          </section>
        )}

        {/* Completion notification - directs to correct Library tab */}
        {!showManufacturing && currentBatch?.status === "done" && clips.filter(c => c.final_url || c.image_url).length > 0 && (
          <section className="text-center py-8">
            {/* Success icon with type-specific styling */}
            <div className={cn(
              "w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center",
              outputType === "video" ? "bg-[#2EE6C9]" : "bg-[#A855F7]"
            )}>
              {outputType === "video" ? (
                <svg className="w-8 h-8 text-[#0B0E11]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              )}
            </div>
            
            {/* Message */}
            <p className="text-white font-semibold text-lg mb-1">
              {clips.filter(c => c.final_url || c.image_url).length} {outputType}{clips.filter(c => c.final_url || c.image_url).length > 1 ? 's' : ''} ready!
            </p>
            <p className="text-[#6B7A8F] text-sm mb-6">
              {outputType === "video" 
                ? "View them in your Studio" 
                : "View them in your Gallery"}
            </p>
            
            {/* View Library button - directs to correct tab */}
            <Link
              href={outputType === "video" ? "/library?tab=studio" : "/library?tab=gallery"}
              className={cn(
                "inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity",
                outputType === "video" 
                  ? "bg-[#2EE6C9] text-[#0B0E11]" 
                  : "bg-[#A855F7] text-white"
              )}
            >
              {outputType === "video" ? (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Open Studio
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                  Open Gallery
                </>
              )}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            
            {/* Create another button */}
            <button
              onClick={() => {
                setCurrentBatch(null);
                setClips([]);
                setIntentText("");
              }}
              className="block w-full mt-4 text-[#6B7A8F] text-sm hover:text-white transition-colors"
            >
              Create another
            </button>
          </section>
        )}

        {/* Batch failed */}
        {!showManufacturing && currentBatch?.status === "failed" && (
          <section className="text-center py-12">
            <p className="text-white font-medium mb-1">Batch failed</p>
            <p className="text-[#6B7A8F] text-sm mb-1">{currentBatch.error || "Something went wrong"}</p>
            <p className="text-[#2EE6C9] text-xs mb-4">No credits were deducted — you&apos;re never charged for failed generations.</p>
            <button
              onClick={() => { setCurrentBatch(null); setClips([]); }}
              className="text-[#2EE6C9] text-sm font-medium hover:underline"
            >
              Try again
            </button>
          </section>
        )}

        {/* Batch cancelled */}
        {!showManufacturing && currentBatch?.status === "cancelled" && (
          <section className="text-center py-12">
            <p className="text-white font-medium mb-1">Batch cancelled</p>
            <p className="text-[#6B7A8F] text-sm mb-1">
              {clips.filter(c => c.status === "ready").length > 0
                ? `${clips.filter(c => c.status === "ready").length} variant${clips.filter(c => c.status === "ready").length > 1 ? "s" : ""} completed before cancellation.`
                : "No variants were completed."}
            </p>
            <p className="text-[#2EE6C9] text-xs mb-4">Credits refunded — you&apos;re only charged for successful outputs.</p>
            <button
              onClick={() => { setCurrentBatch(null); setClips([]); }}
              className="text-[#2EE6C9] text-sm font-medium hover:underline"
            >
              Create another
            </button>
          </section>
        )}

        {/* Empty state */}
        {!currentBatch && !isGenerating && (
          <section className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#12161D] border border-[#1C2230] flex items-center justify-center">
              <span className="text-2xl">{outputType === "video" ? "🎬" : "🖼️"}</span>
            </div>
            <p className="text-[#6B7A8F] text-sm mb-1">
              Describe what you want to create
            </p>
            <p className="text-[#4B5563] text-xs">
              AI generates {outputType === "video" ? `${videoBatchSize} video` : `${imageBatchSize} image`} variations
            </p>
          </section>
        )}
      </main>

      {/* Cost Footer - Always visible */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#0B0E11]/95 backdrop-blur-lg border-t border-[#1C2230] py-3 px-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] text-[#4B5563] uppercase tracking-wider">Balance</p>
              <p className="text-sm font-bold text-[#2EE6C9]">{balanceCents !== null ? formatCost(balanceCents) : "--"}</p>
            </div>
            <div className="w-px h-8 bg-[#1C2230]" />
            <div>
              <p className="text-[10px] text-[#4B5563] uppercase tracking-wider">Session</p>
              <p className="text-sm font-semibold text-white">{formatCost(sessionCost)}</p>
            </div>
            <div className="w-px h-8 bg-[#1C2230]" />
            <div>
              <p className="text-[10px] text-[#4B5563] uppercase tracking-wider">Total Spent</p>
              <p className="text-sm font-semibold text-[#6B7A8F]">{formatCost(totalSpent)}</p>
            </div>
          </div>
          {intentText.trim() && !isGenerating && !isRunning && (
            <div className="text-right">
              <p className="text-[10px] text-[#4B5563] uppercase tracking-wider">Next Run</p>
              <p className="text-sm font-semibold text-white">~{formatCost(estimatedCost.totalCents)}</p>
            </div>
          )}
        </div>
      </footer>

      {/* Spacer for footer */}
      <div className="h-20" />

      {/* Video Modal */}
      <VideoModalFeed
        clips={clips}
        initialIndex={modalInitialIndex}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onToggleWinner={handleToggleWinner}
        onToggleKilled={handleToggleKilled}
      />
    </>
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B0E11] flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-[#2EE6C9]/30 border-t-[#2EE6C9] rounded-full animate-spin" />
      </div>
    }>
      <FeedPageContent />
    </Suspense>
  );
}
