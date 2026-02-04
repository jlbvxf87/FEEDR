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

        {/* Premium Input Section */}
        <section className="space-y-4">
          {/* Main Input Card */}
          <div className="bg-[#12161D] rounded-2xl border border-[#1E2530] overflow-hidden">
            {/* Textarea */}
            <textarea
              value={intentText}
              onChange={(e) => {
                setIntentText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder="Describe your content..."
              disabled={isGenerating || isRunning}
              rows={1}
              className={cn(
                "w-full px-5 pt-5 pb-3 bg-transparent resize-none",
                "text-white text-[15px] placeholder:text-[#4A5568]",
                "focus:outline-none",
                "disabled:opacity-50",
                "min-h-[56px] max-h-[200px]"
              )}
            />
            
            {/* Controls Bar */}
            <div className="px-4 pb-4 flex items-center justify-between gap-3">
              {/* Left: Options */}
              <div className="flex items-center gap-1">
                {/* Output Type */}
                <button
                  onClick={() => setOutputType(outputType === "video" ? "image" : "video")}
                  disabled={isGenerating || isRunning}
                  className={cn(
                    "h-8 px-3 rounded-lg flex items-center gap-2",
                    "text-[13px] font-medium transition-all",
                    "bg-[#1A1F2A] text-[#A0AEC0] hover:text-white",
                    "disabled:opacity-50"
                  )}
                >
                  {outputType === "video" ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                      <span>Video</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                      <span>Image</span>
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="w-px h-5 bg-[#2D3748] mx-1" />

                {/* Quality */}
                <button
                  onClick={() => {
                    const modes: QualityMode[] = ["economy", "balanced", "premium"];
                    const idx = modes.indexOf(qualityMode);
                    setQualityMode(modes[(idx + 1) % 3]);
                  }}
                  disabled={isGenerating || isRunning}
                  className={cn(
                    "h-8 px-3 rounded-lg flex items-center gap-2",
                    "text-[13px] font-medium transition-all",
                    "bg-[#1A1F2A] text-[#A0AEC0] hover:text-white",
                    "disabled:opacity-50"
                  )}
                >
                  {qualityMode === "economy" && (
                    <>
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>Fast</span>
                    </>
                  )}
                  {qualityMode === "balanced" && (
                    <>
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      <span>Balanced</span>
                    </>
                  )}
                  {qualityMode === "premium" && (
                    <>
                      <div className="w-2 h-2 rounded-full bg-purple-400" />
                      <span>Premium</span>
                    </>
                  )}
                </button>

                {/* Preset */}
                <button
                  onClick={() => setShowPresets(!showPresets)}
                  disabled={isGenerating || isRunning}
                  className={cn(
                    "h-8 px-3 rounded-lg flex items-center gap-2",
                    "text-[13px] font-medium transition-all",
                    "bg-[#1A1F2A] text-[#A0AEC0] hover:text-white",
                    "disabled:opacity-50"
                  )}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="hidden sm:inline">{presetLabel}</span>
                </button>

                {/* Research (when has text) */}
                {intentText.trim() && (
                  <button
                    onClick={() => setShowResearch(true)}
                    disabled={isGenerating || isRunning}
                    className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center",
                      "bg-[#1A1F2A] text-[#A0AEC0] hover:text-white",
                      "disabled:opacity-50 transition-all"
                    )}
                    title="Research trends"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Right: Generate */}
              <button
                onClick={handleGenerate}
                disabled={!intentText.trim() || isGenerating || isRunning}
                className={cn(
                  "h-9 px-5 rounded-lg font-medium text-[13px]",
                  "bg-white text-[#0B0E11]",
                  "hover:bg-gray-100 active:scale-[0.98]",
                  "disabled:opacity-30 disabled:cursor-not-allowed",
                  "transition-all flex items-center gap-2"
                )}
              >
                {isGenerating || isRunning ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Generating</span>
                  </>
                ) : (
                  <>
                    <span>Generate</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                )}
              </button>
            </div>
            
            {/* Cost indicator */}
            {intentText.trim() && !isGenerating && !isRunning && (
              <div className="px-5 pb-3 -mt-1">
                <p className="text-[11px] text-[#4A5568]">
                  Est. {formatCost(estimateBatchCost(qualityMode, outputType, outputType === "image" ? 9 : 10).totalCents)} · {outputType === "image" ? "9 images" : "10 videos"}
                </p>
              </div>
            )}
          </div>

          {/* Dev Mode */}
          {isDevMode && (
            <button
              onClick={handleRunWorker}
              className="text-xs text-[#4A5568] hover:text-white transition-colors"
            >
              Run Worker
            </button>
          )}

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
