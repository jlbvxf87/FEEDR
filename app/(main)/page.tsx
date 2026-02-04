"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import type { Preset, Batch, Clip, PresetKey, BatchMode, BatchSize, OutputType, ImageType } from "@/lib/types";
import { ImagePack, IMAGE_PACKS, generateImagePrompts } from "@/lib/imagePresets";
import { QualityMode, estimateBatchCost, formatCost, analyzeComplexity } from "@/lib/costs";
import { ImagePackSelector } from "@/components/ImagePackSelector";
import { QualityModeToggle } from "@/components/QualityModeSelector";
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
          {/* Main Input */}
          <div className="relative">
            <input
              type="text"
              value={intentText}
              onChange={(e) => setIntentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              placeholder="What are we feeding today?"
              disabled={isGenerating || isRunning}
              className={cn(
                "w-full px-5 py-4 rounded-xl",
                "bg-[#1C2230] border border-[#2D3748]",
                "text-white placeholder:text-[#6B7280]",
                "focus:outline-none focus:border-[#2EE6C9]/50",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-all duration-200"
              )}
            />
          </div>

          {/* KISS Controls: Output Type Toggle + Preset dropdown + FEED button */}
          <div className="flex items-center gap-3">
            {/* Video/Photo Toggle */}
            <div className="flex rounded-lg overflow-hidden border border-[#2D3748]">
              <button
                onClick={() => setOutputType("video")}
                disabled={isGenerating || isRunning}
                className={cn(
                  "px-3 py-2 text-xs uppercase tracking-wider font-medium transition-all",
                  outputType === "video"
                    ? "bg-[#2EE6C9] text-[#0B0E11]"
                    : "bg-[#1C2230] text-[#6B7280] hover:text-white",
                  "disabled:opacity-50"
                )}
              >
                🎬 Video
              </button>
              <button
                onClick={() => setOutputType("image")}
                disabled={isGenerating || isRunning}
                className={cn(
                  "px-3 py-2 text-xs uppercase tracking-wider font-medium transition-all",
                  outputType === "image"
                    ? "bg-[#2EE6C9] text-[#0B0E11]"
                    : "bg-[#1C2230] text-[#6B7280] hover:text-white",
                  "disabled:opacity-50"
                )}
              >
                📷 Photo
              </button>
            </div>

            {/* Quality Mode Toggle */}
            <QualityModeToggle
              selected={qualityMode}
              onSelect={setQualityMode}
              disabled={isGenerating || isRunning}
            />

            {/* Image Pack (only when Photo selected) */}
            {outputType === "image" && (
              <button
                onClick={() => setShowImagePacks(!showImagePacks)}
                disabled={isGenerating || isRunning}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-lg",
                  "bg-[#1C2230] border border-[#2D3748]",
                  "text-xs text-white",
                  "hover:border-[#2EE6C9]/30",
                  "disabled:opacity-50"
                )}
              >
                <span>{IMAGE_PACKS[imagePack].icon}</span>
                <span>{IMAGE_PACKS[imagePack].name}</span>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className={cn("transition-transform", showImagePacks && "rotate-180")}>
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
            
            {/* Preset Dropdown */}
            <button
              onClick={() => setShowPresets(!showPresets)}
              disabled={isGenerating || isRunning}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg",
                "bg-[#1C2230] border border-[#2D3748]",
                "text-sm text-white",
                "hover:border-[#2EE6C9]/30",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-all duration-200"
              )}
            >
              <span className="uppercase tracking-wider">{presetLabel}</span>
              <svg 
                width="12" 
                height="12" 
                viewBox="0 0 12 12" 
                fill="none" 
                className={cn(
                  "transition-transform duration-200",
                  showPresets && "rotate-180"
                )}
              >
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Research Button */}
            {intentText.trim() && (
              <button
                onClick={() => setShowResearch(true)}
                disabled={isGenerating || isRunning}
                className={cn(
                  "px-3 py-2.5 rounded-lg",
                  "bg-[#1C2230] border border-[#2D3748]",
                  "text-xs text-[#6B7280] hover:text-[#2EE6C9] hover:border-[#2EE6C9]/30",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "transition-all duration-200"
                )}
                title="Research trending hooks"
              >
                🔍
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

            {/* FEED Button with Cost */}
            <div className="flex-1 flex flex-col gap-1">
              <button
                onClick={handleGenerate}
                disabled={!intentText.trim() || isGenerating || isRunning}
                className={cn(
                  "w-full py-2.5 rounded-lg font-semibold uppercase tracking-wider",
                  "bg-gradient-to-r from-[#2EE6C9] to-[#0095FF] text-[#0B0E11]",
                  "hover:opacity-90",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  "transition-all duration-200",
                  !isGenerating && !isRunning && intentText.trim() && "shadow-lg shadow-[#2EE6C9]/20"
                )}
              >
                {isGenerating || isRunning ? "COOKING..." : outputType === "image" ? "GENERATE" : "FEED"}
              </button>
              {intentText.trim() && !isGenerating && !isRunning && (
                <p className="text-[10px] text-[#6B7280] text-center">
                  Est. {formatCost(estimateBatchCost(qualityMode, outputType, outputType === "image" ? 9 : 10).totalCents)} • {qualityMode}
                </p>
              )}
            </div>
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
