"use client";

import { useState, useEffect, useCallback, Suspense, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import type { Preset, Batch, Clip, PresetKey, BatchMode, BatchSize, OutputType } from "@/lib/types";
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
  const [recentWinners, setRecentWinners] = useState<Clip[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialIndex, setModalInitialIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Input state
  const [intentText, setIntentText] = useState("");
  const [showPresets, setShowPresets] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
  const [videoBatchSize, setVideoBatchSize] = useState<1 | 3 | 5>(3);
  const [imagePack, setImagePack] = useState<ImagePack>("auto");
  const [showImagePacks, setShowImagePacks] = useState(false);
  
  // Cost tracking
  const [totalSpent, setTotalSpent] = useState(0);
  const [sessionCost, setSessionCost] = useState(0);

  const supabase = createClient();

  // Calculate estimated cost based on current settings
  const estimatedCost = useMemo(() => {
    const batchSize = outputType === "image" ? 9 : videoBatchSize;
    const analysis = analyzeComplexity(intentText);
    const mode = analysis.suggestedMode;
    const estimate = estimateBatchCost(mode, outputType, batchSize);
    return {
      ...estimate,
      mode,
      modeLabel: QUALITY_TIERS[mode].label,
      batchSize,
    };
  }, [intentText, outputType, videoBatchSize]);

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

        const { data: winnersData } = await supabase
          .from("clips")
          .select("*")
          .eq("winner", true)
          .eq("status", "ready")
          .order("created_at", { ascending: false })
          .limit(6);

        setRecentWinners((winnersData || []) as Clip[]);

        // Load total spent (sum of all batch costs)
        const { data: batchesData } = await supabase
          .from("batches")
          .select("estimated_cost")
          .not("estimated_cost", "is", null);
        
        if (batchesData) {
          const total = batchesData.reduce((sum, b) => sum + (b.estimated_cost || 0), 0);
          setTotalSpent(total);
        }

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
      const mode: BatchMode = "hook_test";
      const batchSize = outputType === "image" ? 9 : videoBatchSize;
      
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
        },
      });

      if (error) throw error;

      // Update session cost
      setSessionCost(prev => prev + estimatedCost.totalCents);
      setTotalSpent(prev => prev + estimatedCost.totalCents);

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
  }, [intentText, selectedPreset, outputType, imagePack, estimatedCost, isGenerating]);

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
            "flex items-center justify-between p-3 rounded-xl",
            "bg-[#12161D] border border-[#1C2230]",
            (isGenerating || isRunning) && "opacity-50 pointer-events-none"
          )}>
            {/* Batch size selector */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#6B7A8F]">
                {outputType === "video" ? "Videos:" : "Images:"}
              </span>
              {outputType === "video" ? (
                <div className="flex items-center bg-[#0B0E11] rounded-lg p-0.5">
                  {([1, 3, 5] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => setVideoBatchSize(size)}
                      disabled={isGenerating || isRunning}
                      className={cn(
                        "w-8 h-7 rounded-md text-sm font-medium transition-all",
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
                <span className="text-sm text-white font-medium">9</span>
              )}
            </div>

            {/* Cost estimate */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6B7A8F]">Est. cost:</span>
              <span className="text-sm text-[#2EE6C9] font-semibold">
                {formatCost(estimatedCost.totalCents)}
              </span>
            </div>
          </div>

          {/* Style selector - subtle */}
          <div className="flex justify-center">
            <button
              onClick={() => setShowPresets(!showPresets)}
              disabled={isGenerating || isRunning}
              className="text-xs text-[#4B5563] hover:text-[#6B7A8F] transition-colors disabled:opacity-50"
            >
              Style: {selectedPreset === "AUTO" ? "Auto" : presetLabel}
            </button>
          </div>

          {/* Preset Grid */}
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

        {/* Workflow & Results */}
        {showManufacturing && currentBatch && (
          <section className="space-y-4">
            <ManufacturingPanel
              clips={clips}
              batch={currentBatch}
            />
            <ResultsGrid
              clips={clips}
              onClipClick={handleClipClick}
              isLoading={isRunning}
            />
          </section>
        )}

        {!showManufacturing && clips.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-white">Results</h2>
              <span className="text-xs text-[#4B5563]">
                {clips.filter(c => c.status === "ready").length} ready
              </span>
            </div>
            <ResultsGrid
              clips={clips}
              onClipClick={handleClipClick}
              isLoading={false}
            />
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
              AI generates {outputType === "video" ? "3 video" : "9 image"} variations
            </p>
          </section>
        )}

        {/* Recent Winners */}
        {!currentBatch && recentWinners.length > 0 && (
          <section>
            <h2 className="text-xs font-medium text-[#4B5563] uppercase tracking-wider mb-3">
              Recent Winners
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {recentWinners.slice(0, 3).map((clip) => (
                <div
                  key={clip.id}
                  className="aspect-[9/16] rounded-xl overflow-hidden bg-[#12161D] border border-[#1C2230]"
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

      {/* Cost Footer - Always visible */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#0B0E11]/95 backdrop-blur-lg border-t border-[#1C2230] py-3 px-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] text-[#4B5563] uppercase tracking-wider">Session</p>
              <p className="text-sm font-semibold text-white">{formatCost(sessionCost)}</p>
            </div>
            <div className="w-px h-8 bg-[#1C2230]" />
            <div>
              <p className="text-[10px] text-[#4B5563] uppercase tracking-wider">Total</p>
              <p className="text-sm font-semibold text-[#2EE6C9]">{formatCost(totalSpent)}</p>
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
