"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import type { Preset, Batch, Clip, PresetKey, BatchMode, BatchSize, OutputType, ImageType } from "@/lib/types";
import { ImagePack, IMAGE_PACKS, generateImagePrompts } from "@/lib/imagePresets";
import { QualityMode, estimateBatchCost, formatCost } from "@/lib/costs";
import { ImagePackSelector } from "@/components/ImagePackSelector";
import { Header } from "@/components/nav/Header";
import { PresetGrid } from "@/components/PresetGrid";
import { ResultsGrid } from "@/components/ResultsGrid";
import { ManufacturingPanel } from "@/components/ManufacturingPanel";
import { VideoModalFeed } from "@/components/VideoModalFeed";
import { ResearchPanel } from "@/components/ResearchPanel";
import { cn } from "@/lib/utils";

function FeedPageContent() {
  const searchParams = useSearchParams();
  const isDevMode = searchParams.get("dev") === "1";

  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>("AUTO");
  const [currentBatch, setCurrentBatch] = useState<Batch | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [recentWinners, setRecentWinners] = useState<Clip[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialIndex, setModalInitialIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // KISS: Simplified input state
  const [intentText, setIntentText] = useState("");
  const [showPresets, setShowPresets] = useState(false);
  const [showResearch, setShowResearch] = useState(false);
  
  // Output type toggle (Video vs Photo)
  const [outputType, setOutputType] = useState<OutputType>("video");
  const [imagePack, setImagePack] = useState<ImagePack>("auto");
  const [showImagePacks, setShowImagePacks] = useState(false);
  
  // Quality mode for cost optimization
  const [qualityMode, setQualityMode] = useState<QualityMode>("balanced");
  const [showCostInfo, setShowCostInfo] = useState(false);

  const supabase = createClient();

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load presets
        const { data: presetsData, error: presetsError } = await supabase
          .from("presets")
          .select("*")
          .eq("is_active", true)
          .order("key");

        if (presetsError) throw presetsError;
        setPresets((presetsData || []) as Preset[]);

        // Load recent winners
        const { data: winnersData } = await supabase
          .from("clips")
          .select("*")
          .eq("winner", true)
          .eq("status", "ready")
          .order("created_at", { ascending: false })
          .limit(6);

        setRecentWinners((winnersData || []) as Clip[]);

        // Load latest batch
        const { data: batchData } = await supabase
          .from("batches")
          .select("*")
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

  // Poll for updates while batch is running
  useEffect(() => {
    if (!currentBatch || currentBatch.status !== "running") return;

    const pollInterval = setInterval(async () => {
      try {
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
      // Direct call to generate-batch (simple mode)
      const mode: BatchMode = "hook_test";
      const batchSize: BatchSize = 10;
      
      const imagePrompts = outputType === "image" 
        ? generateImagePrompts(intentText.trim(), imagePack)
        : undefined;
      
      const { data, error } = await supabase.functions.invoke("generate-batch", {
        body: { 
          intent_text: intentText.trim(), 
          preset_key: selectedPreset, 
          mode, 
          batch_size: outputType === "image" ? 9 : batchSize,
          output_type: outputType,
          image_pack: outputType === "image" ? imagePack : undefined,
          image_prompts: imagePrompts,
          quality_mode: qualityMode,
        },
      });

      if (error) throw error;

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
    } catch (err) {
      console.error("Generate error:", err);
      setError(err instanceof Error ? err.message : "Something broke. Try again.");
      setIsGenerating(false);
    }
  }, [intentText, selectedPreset, outputType, imagePack, qualityMode, isGenerating]);

  const handleRunWorker = useCallback(async () => {
    try {
      await supabase.functions.invoke("worker", {
        body: { action: "run-once" },
      });
    } catch (err) {
      console.error("Worker error:", err);
    }
  }, []);

  const handleToggleWinner = useCallback(async (clipId: string, winner: boolean) => {
    await supabase.from("clips").update({ winner }).eq("id", clipId);
    setClips((prev) => prev.map((c) => (c.id === clipId ? { ...c, winner } : c)));
  }, []);

  const handleToggleKilled = useCallback(async (clipId: string, killed: boolean) => {
    await supabase.from("clips").update({ killed }).eq("id", clipId);
    setClips((prev) => prev.map((c) => (c.id === clipId ? { ...c, killed } : c)));
  }, []);

  const handleClipClick = useCallback((index: number) => {
    const clip = clips[index];
    if (clip?.status === "ready") {
      setModalInitialIndex(index);
      setModalOpen(true);
    }
  }, [clips]);

  const isRunning = currentBatch?.status === "running";
  const showManufacturing = isRunning || isGenerating;

  // Get preset display name
  const selectedPresetData = presets.find(p => p.key === selectedPreset);
  const presetLabel = selectedPresetData?.name || selectedPreset;

  return (
    <>
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-4 space-y-6">
        {/* Error display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-500 text-xs">
            {error}
          </div>
        )}

        {/* KISS Input Section */}
        <section className="space-y-3">
          {/* Main Input - Expandable Textarea for Detailed Prompts */}
          <div className="relative">
            <textarea
              value={intentText}
              onChange={(e) => {
                setIntentText(e.target.value);
                // Auto-resize
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 300) + "px";
              }}
              onKeyDown={(e) => {
                // Cmd/Ctrl + Enter to submit
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder={`What are we feeding today?

Examples:
• "Jordan 4s unboxing, hype energy, fast cuts"
• "Luxury skincare ad, soft lighting, ASMR vibes, target 25-35 women"
• "SaaS product demo, clean UI showcase, professional tone, 30 sec"`}
              disabled={isGenerating || isRunning}
              rows={2}
              className={cn(
                "w-full px-5 py-4 rounded-xl resize-none",
                "bg-[#1C2230] border border-[#2D3748]",
                "text-white placeholder:text-[#6B7280] placeholder:text-sm",
                "focus:outline-none focus:border-[#2EE6C9]/50",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-all duration-200",
                "min-h-[60px] max-h-[300px]"
              )}
              style={{ overflow: "hidden" }}
            />
            {/* Character count & hint */}
            <div className="absolute bottom-2 right-3 flex items-center gap-3">
              {intentText.length > 0 && (
                <span className={cn(
                  "text-[10px]",
                  intentText.length > 500 ? "text-yellow-500" : "text-[#4B5563]"
                )}>
                  {intentText.length}
                </span>
              )}
              <span className="text-[10px] text-[#4B5563]">
                ⌘↵ to generate
              </span>
            </div>
          </div>

          {/* Controls Row - Mobile Optimized */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Output Type Toggle */}
            <div className="flex rounded-md overflow-hidden border border-[#2D3748] h-9">
              <button
                onClick={() => setOutputType("video")}
                disabled={isGenerating || isRunning}
                className={cn(
                  "px-3 flex items-center gap-1.5 text-xs font-medium transition-all",
                  outputType === "video"
                    ? "bg-[#2EE6C9] text-[#0B0E11]"
                    : "bg-[#1C2230] text-[#6B7280] hover:text-white",
                  "disabled:opacity-50"
                )}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Video</span>
              </button>
              <button
                onClick={() => setOutputType("image")}
                disabled={isGenerating || isRunning}
                className={cn(
                  "px-3 flex items-center gap-1.5 text-xs font-medium transition-all",
                  outputType === "image"
                    ? "bg-[#2EE6C9] text-[#0B0E11]"
                    : "bg-[#1C2230] text-[#6B7280] hover:text-white",
                  "disabled:opacity-50"
                )}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Image</span>
              </button>
            </div>

            {/* Quality Mode Toggle - Pro Icons */}
            <div className="flex rounded-md overflow-hidden border border-[#2D3748] h-9">
              {(["economy", "balanced", "premium"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setQualityMode(mode)}
                  disabled={isGenerating || isRunning}
                  title={mode === "economy" ? "Economy - Fastest" : mode === "balanced" ? "Balanced - Best value" : "Premium - Highest quality"}
                  className={cn(
                    "px-2.5 flex items-center justify-center transition-all",
                    qualityMode === mode
                      ? "bg-[#2EE6C9] text-[#0B0E11]"
                      : "bg-[#1C2230] text-[#6B7280] hover:text-white",
                    "disabled:opacity-50"
                  )}
                >
                  {mode === "economy" && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  {mode === "balanced" && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                    </svg>
                  )}
                  {mode === "premium" && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {/* Preset Dropdown */}
            <button
              onClick={() => setShowPresets(!showPresets)}
              disabled={isGenerating || isRunning}
              className={cn(
                "flex items-center gap-1.5 px-3 h-9 rounded-md",
                "bg-[#1C2230] border border-[#2D3748]",
                "text-xs text-white font-medium",
                "hover:border-[#2EE6C9]/30",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-all"
              )}
            >
              <span className="uppercase tracking-wide">{presetLabel}</span>
              <svg 
                className={cn("w-3 h-3 transition-transform", showPresets && "rotate-180")}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Image Pack (only when Photo selected) */}
            {outputType === "image" && (
              <button
                onClick={() => setShowImagePacks(!showImagePacks)}
                disabled={isGenerating || isRunning}
                className={cn(
                  "flex items-center gap-1.5 px-3 h-9 rounded-md",
                  "bg-[#1C2230] border border-[#2D3748]",
                  "text-xs text-white font-medium",
                  "hover:border-[#2EE6C9]/30",
                  "disabled:opacity-50"
                )}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="hidden sm:inline">{IMAGE_PACKS[imagePack].name}</span>
                <svg className={cn("w-3 h-3 transition-transform", showImagePacks && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}

            {/* Research Button */}
            {intentText.trim() && (
              <button
                onClick={() => setShowResearch(true)}
                disabled={isGenerating || isRunning}
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-md",
                  "bg-[#1C2230] border border-[#2D3748]",
                  "text-[#6B7280] hover:text-[#2EE6C9] hover:border-[#2EE6C9]/30",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "transition-all"
                )}
                title="Research trends"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}

            {/* Dev: Run Worker */}
            {isDevMode && (
              <button
                onClick={handleRunWorker}
                className="px-3 py-2.5 rounded-lg bg-[#1C2230] border border-[#2D3748] text-xs text-[#6B7280] hover:text-white"
              >
                Run Worker
              </button>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!intentText.trim() || isGenerating || isRunning}
              className={cn(
                "flex-1 min-w-[100px] h-9 rounded-md font-semibold text-sm",
                "bg-gradient-to-r from-[#2EE6C9] to-[#0095FF] text-[#0B0E11]",
                "hover:opacity-90 active:scale-[0.98]",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                "transition-all",
                !isGenerating && !isRunning && intentText.trim() && "shadow-lg shadow-[#2EE6C9]/20"
              )}
            >
              {isGenerating || isRunning ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  Generate
                  {intentText.trim() && (
                    <span className="text-[10px] opacity-70">
                      ~{formatCost(estimateBatchCost(qualityMode, outputType, outputType === "image" ? 9 : 10).totalCents)}
                    </span>
                  )}
                </span>
              )}
            </button>
          </div>

          {/* Image Pack Selector (only when Photo selected) */}
          {outputType === "image" && showImagePacks && (
            <div className="pt-2">
              <ImagePackSelector
                selected={imagePack}
                onSelect={(pack) => {
                  setImagePack(pack);
                  setShowImagePacks(false);
                }}
                disabled={isGenerating || isRunning}
              />
              <p className="text-xs text-[#6B7280] mt-2 px-1">
                {IMAGE_PACKS[imagePack].description} • Generates 9 images with optimal sizes
              </p>
            </div>
          )}

          {/* Preset Grid (expandable) */}
          {showPresets && (
            <div className="pt-2">
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
          )}
        </section>

        {/* Results Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-[#6B7280] uppercase tracking-wider">
              {showManufacturing ? "Feeding..." : "Your Feed"}
            </h2>
            {clips.length > 0 && (
              <span className="text-xs text-[#6B7280]">
                {clips.filter(c => c.status === "ready").length}/{clips.length} ready
              </span>
            )}
          </div>

          {showManufacturing && currentBatch && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ManufacturingPanel
                clips={clips}
                batch={currentBatch}
                recentWinners={recentWinners}
              />
              <ResultsGrid
                clips={clips}
                onClipClick={handleClipClick}
                isLoading={isRunning}
              />
            </div>
          )}

          {!showManufacturing && clips.length > 0 && (
            <ResultsGrid
              clips={clips}
              onClipClick={handleClipClick}
              isLoading={false}
            />
          )}

          {!currentBatch && !isGenerating && (
            <div className="text-center py-12">
              <p className="text-[#6B7280] text-sm mb-2">
                Type something above and hit FEED
              </p>
              <p className="text-[#4B5563] text-xs">
                We&apos;ll generate 10 video variations for you to review
              </p>
            </div>
          )}
        </section>

        {/* Recent Winners Preview (when no active batch) */}
        {!currentBatch && recentWinners.length > 0 && (
          <section>
            <h2 className="text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-3">
              Recent Winners
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {recentWinners.slice(0, 3).map((clip) => (
                <div
                  key={clip.id}
                  className="aspect-[9/16] rounded-lg overflow-hidden bg-[#1C2230]"
                >
                  {clip.final_url && (
                    <video
                      src={clip.final_url}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Video Modal */}
      <VideoModalFeed
        clips={clips}
        initialIndex={modalInitialIndex}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onToggleWinner={handleToggleWinner}
        onToggleKilled={handleToggleKilled}
      />

      {/* Research Panel */}
      {showResearch && (
        <ResearchPanel
          query={intentText}
          onUseHook={(hook) => {
            setIntentText(hook);
            setShowResearch(false);
          }}
          onClose={() => setShowResearch(false)}
        />
      )}
    </>
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B0E11] flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-[#2EE6C9] animate-pulse" />
      </div>
    }>
      <FeedPageContent />
    </Suspense>
  );
}
