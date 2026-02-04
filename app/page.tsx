"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import type { Preset, Batch, Clip, PresetKey, BatchMode, BatchSize } from "@/lib/types";
import { InputBar } from "@/components/InputBar";
import { PresetGrid } from "@/components/PresetGrid";
import { ResultsGrid } from "@/components/ResultsGrid";
import { ManufacturingPanel } from "@/components/ManufacturingPanel";
import { VideoModalFeed } from "@/components/VideoModalFeed";
import { SplashScreen } from "@/components/SplashScreen";
import Image from "next/image";

function HomePageContent() {
  const searchParams = useSearchParams();
  const isDevMode = searchParams.get("dev") === "1";
  const router = useRouter();

  const [showSplash, setShowSplash] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>("AUTO");
  const [currentBatch, setCurrentBatch] = useState<Batch | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [recentWinners, setRecentWinners] = useState<Clip[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialIndex, setModalInitialIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Check auth
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
      } else {
        setIsAuthLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  // Load initial data
  useEffect(() => {
    if (isAuthLoading) return;
    
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

        // Load recent winners (for warm-up scroll)
        const { data: winnersData } = await supabase
          .from("clips")
          .select("*")
          .eq("winner", true)
          .eq("status", "ready")
          .order("created_at", { ascending: false })
          .limit(6);

        setRecentWinners((winnersData || []) as Clip[]);

        // Load latest batch
        const { data: batchData, error: batchError } = await supabase
          .from("batches")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (batchError && batchError.code !== "PGRST116") {
          throw batchError;
        }

        if (batchData) {
          setCurrentBatch(batchData as Batch);
          // Load clips for this batch
          const { data: clipsData, error: clipsError } = await supabase
            .from("clips")
            .select("*")
            .eq("batch_id", (batchData as Batch).id)
            .order("variant_id");

          if (clipsError) throw clipsError;
          setClips((clipsData || []) as Clip[]);
        }
      } catch (err) {
        console.error("Error loading data:", err);
        setError(err instanceof Error ? err.message : "Something broke. Try again.");
      }
    };

    loadData();
  }, [isAuthLoading]);

  // Poll for updates while batch is running
  useEffect(() => {
    if (!currentBatch || currentBatch.status !== "running") return;

    const pollInterval = setInterval(async () => {
      try {
        const { data: batchData, error: batchError } = await supabase
          .from("batches")
          .select("*")
          .eq("id", currentBatch.id)
          .single();

        if (batchError) throw batchError;
        const batch = batchData as Batch;
        setCurrentBatch(batch);

        const { data: clipsData, error: clipsError } = await supabase
          .from("clips")
          .select("*")
          .eq("batch_id", currentBatch.id)
          .order("variant_id");

        if (clipsError) throw clipsError;
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

  const handleGenerate = useCallback(
    async (
      intentText: string,
      presetKey: PresetKey,
      mode: BatchMode,
      batchSize: BatchSize
    ) => {
      setIsGenerating(true);
      setError(null);

      try {
        const { data, error } = await supabase.functions.invoke("generate-batch", {
          body: { intent_text: intentText, preset_key: presetKey, mode, batch_size: batchSize },
        });

        if (error) throw error;

        const { data: batchData, error: batchError } = await supabase
          .from("batches")
          .select("*")
          .eq("id", data.batch_id)
          .single();

        if (batchError) throw batchError;
        setCurrentBatch(batchData as Batch);

        const { data: clipsData, error: clipsError } = await supabase
          .from("clips")
          .select("*")
          .eq("batch_id", data.batch_id)
          .order("variant_id");

        if (clipsError) throw clipsError;
        setClips((clipsData || []) as Clip[]);
      } catch (err) {
        console.error("Generate error:", err);
        setError(err instanceof Error ? err.message : "Something broke. Try again.");
        setIsGenerating(false);
      }
    },
    []
  );

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
    const { error } = await supabase
      .from("clips")
      .update({ winner })
      .eq("id", clipId);

    if (error) throw error;

    setClips((prev) =>
      prev.map((c) => (c.id === clipId ? { ...c, winner } : c))
    );
  }, []);

  const handleToggleKilled = useCallback(async (clipId: string, killed: boolean) => {
    const { error } = await supabase
      .from("clips")
      .update({ killed })
      .eq("id", clipId);

    if (error) throw error;

    setClips((prev) =>
      prev.map((c) => (c.id === clipId ? { ...c, killed } : c))
    );
  }, []);

  const handleClipClick = useCallback((index: number) => {
    const clip = clips[index];
    if (clip?.status === "ready") {
      setModalInitialIndex(index);
      setModalOpen(true);
    }
  }, [clips]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Auth loading state
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#0B0E11] flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-[#2EE6C9] animate-pulse" />
      </div>
    );
  }

  const isRunning = currentBatch?.status === "running";
  const showManufacturing = isRunning || isGenerating;

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      
      <div className="min-h-screen bg-[#0B0E11]">
        {/* Header */}
        <header className="border-b border-[#1C2230]">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Image
              src="/logo.png"
              alt="FEEDR"
              width={120}
              height={30}
              className="object-contain"
              priority
            />
            <button
              onClick={handleSignOut}
              className="text-xs text-[#6B7280] hover:text-white transition-colors uppercase tracking-wider"
            >
              Exit
            </button>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-6xl mx-auto px-6 py-8">
          <div className="space-y-8">
            {/* Error display */}
            {error && (
              <div className="bg-[#FF4D4F]/10 border border-[#FF4D4F]/20 rounded-lg p-4 text-[#FF4D4F] text-xs uppercase tracking-wider">
                {error}
              </div>
            )}

            {/* Input Bar */}
            <section>
              <InputBar
                onGenerate={handleGenerate}
                selectedPreset={selectedPreset}
                isGenerating={isGenerating || isRunning}
              />
            </section>

            {/* Presets Grid */}
            <section>
              <h2 className="text-xs font-medium text-[#6B7280] mb-3 uppercase tracking-wider">
                Select Mode
              </h2>
              <PresetGrid
                presets={presets}
                selectedKey={selectedPreset}
                onSelect={setSelectedPreset}
                disabled={isGenerating || isRunning}
              />
            </section>

            {/* Manufacturing Panel / Results Grid */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                  {showManufacturing ? "Feeding the line..." : "Tray"}
                </h2>
                {isDevMode && (
                  <button
                    onClick={handleRunWorker}
                    className="text-xs px-3 py-1 rounded bg-[#1C2230] text-[#6B7280] hover:text-white transition-colors uppercase tracking-wider"
                  >
                    Run Worker
                  </button>
                )}
              </div>

              {showManufacturing && currentBatch && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

              {!showManufacturing && (
                <ResultsGrid
                  clips={clips}
                  onClipClick={handleClipClick}
                  isLoading={false}
                />
              )}

              {!currentBatch && !isGenerating && (
                <div className="text-center py-16 text-[#4B5563] text-sm">
                  Type something above and hit FEED
                </div>
              )}
            </section>

            {/* Video Modal */}
            <VideoModalFeed
              clips={clips}
              initialIndex={modalInitialIndex}
              isOpen={modalOpen}
              onClose={() => setModalOpen(false)}
              onToggleWinner={handleToggleWinner}
              onToggleKilled={handleToggleKilled}
            />
          </div>
        </main>
      </div>
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B0E11] flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-[#2EE6C9] animate-pulse" />
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
}
