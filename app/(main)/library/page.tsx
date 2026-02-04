"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { Header } from "@/components/nav/Header";
import { VideoModalFeed } from "@/components/VideoModalFeed";
import type { Batch, Clip } from "@/lib/types";
import { cn } from "@/lib/utils";

type FilterType = "all" | "winners" | "batches";

interface BatchWithClips extends Batch {
  clips: Clip[];
}

export default function LibraryPage() {
  const [filter, setFilter] = useState<FilterType>("winners");
  const [batches, setBatches] = useState<BatchWithClips[]>([]);
  const [allWinners, setAllWinners] = useState<Clip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalClips, setModalClips] = useState<Clip[]>([]);
  const [modalInitialIndex, setModalInitialIndex] = useState(0);

  const supabase = createClient();

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load all batches with their clips
        const { data: batchesData, error: batchesError } = await supabase
          .from("batches")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);

        if (batchesError) throw batchesError;

        // Load clips for each batch
        const batchesWithClips: BatchWithClips[] = [];
        for (const batch of batchesData || []) {
          const { data: clipsData } = await supabase
            .from("clips")
            .select("*")
            .eq("batch_id", batch.id)
            .order("variant_id");
          
          batchesWithClips.push({
            ...batch,
            clips: (clipsData || []) as Clip[],
          });
        }
        setBatches(batchesWithClips);

        // Load all winners
        const { data: winnersData, error: winnersError } = await supabase
          .from("clips")
          .select("*")
          .eq("winner", true)
          .eq("status", "ready")
          .order("created_at", { ascending: false })
          .limit(100);

        if (winnersError) throw winnersError;
        setAllWinners((winnersData || []) as Clip[]);

      } catch (err) {
        console.error("Error loading library:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleClipClick = useCallback((clips: Clip[], index: number) => {
    setModalClips(clips.filter(c => c.status === "ready"));
    setModalInitialIndex(index);
    setModalOpen(true);
  }, []);

  const handleToggleWinner = useCallback(async (clipId: string, winner: boolean) => {
    await supabase.from("clips").update({ winner }).eq("id", clipId);
    
    // Update local state
    setBatches(prev => prev.map(batch => ({
      ...batch,
      clips: batch.clips.map(c => c.id === clipId ? { ...c, winner } : c),
    })));
    
    if (winner) {
      const clip = batches.flatMap(b => b.clips).find(c => c.id === clipId);
      if (clip) {
        setAllWinners(prev => [{ ...clip, winner: true }, ...prev]);
      }
    } else {
      setAllWinners(prev => prev.filter(c => c.id !== clipId));
    }
    
    setModalClips(prev => prev.map(c => c.id === clipId ? { ...c, winner } : c));
  }, [batches]);

  const handleToggleKilled = useCallback(async (clipId: string, killed: boolean) => {
    await supabase.from("clips").update({ killed }).eq("id", clipId);
    
    setBatches(prev => prev.map(batch => ({
      ...batch,
      clips: batch.clips.map(c => c.id === clipId ? { ...c, killed } : c),
    })));
    
    setModalClips(prev => prev.map(c => c.id === clipId ? { ...c, killed } : c));
  }, []);

  // Group batches by date
  const groupedBatches = batches.reduce((acc, batch) => {
    const date = new Date(batch.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let label: string;
    if (date.toDateString() === today.toDateString()) {
      label = "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      label = "Yesterday";
    } else {
      label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    
    if (!acc[label]) acc[label] = [];
    acc[label].push(batch);
    return acc;
  }, {} as Record<string, BatchWithClips[]>);

  return (
    <>
      <Header title="Library" />
      
      <main className="max-w-6xl mx-auto px-4 py-4">
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(["winners", "batches", "all"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-2 rounded-lg text-xs uppercase tracking-wider font-medium whitespace-nowrap transition-all",
                filter === f
                  ? "bg-[#2EE6C9] text-[#0B0E11]"
                  : "bg-[#1C2230] text-[#6B7280] hover:text-white"
              )}
            >
              {f === "winners" && "🏆 Winners"}
              {f === "batches" && "📦 Batches"}
              {f === "all" && "📋 All Clips"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-1.5 h-1.5 rounded-full bg-[#2EE6C9] animate-pulse" />
          </div>
        ) : (
          <>
            {/* Winners View */}
            {filter === "winners" && (
              <div className="space-y-4">
                {allWinners.length === 0 ? (
                  <div className="text-center py-16 text-[#6B7280] text-sm">
                    No winners yet. Generate some clips and pick your favorites!
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {allWinners.map((clip, index) => (
                      <ClipThumbnail
                        key={clip.id}
                        clip={clip}
                        onClick={() => handleClipClick(allWinners, index)}
                        showWinner
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Batches View */}
            {filter === "batches" && (
              <div className="space-y-6">
                {Object.entries(groupedBatches).map(([date, dateBatches]) => (
                  <div key={date}>
                    <h3 className="text-xs text-[#6B7280] uppercase tracking-wider mb-3">
                      {date}
                    </h3>
                    <div className="space-y-4">
                      {dateBatches.map((batch) => (
                        <BatchCard
                          key={batch.id}
                          batch={batch}
                          onClipClick={(index) => handleClipClick(batch.clips, index)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* All Clips View */}
            {filter === "all" && (
              <div className="grid grid-cols-3 gap-2">
                {batches.flatMap(b => b.clips).filter(c => c.status === "ready").map((clip, index) => (
                  <ClipThumbnail
                    key={clip.id}
                    clip={clip}
                    onClick={() => handleClipClick(
                      batches.flatMap(b => b.clips).filter(c => c.status === "ready"),
                      index
                    )}
                    showWinner={clip.winner}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Video Modal */}
      <VideoModalFeed
        clips={modalClips}
        initialIndex={modalInitialIndex}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onToggleWinner={handleToggleWinner}
        onToggleKilled={handleToggleKilled}
      />
    </>
  );
}

// Clip Thumbnail Component
function ClipThumbnail({ 
  clip, 
  onClick, 
  showWinner = false 
}: { 
  clip: Clip; 
  onClick: () => void;
  showWinner?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="relative aspect-[9/16] rounded-lg overflow-hidden bg-[#1C2230] group"
    >
      {clip.final_url && (
        <video
          src={clip.final_url}
          className="w-full h-full object-cover"
          muted
          playsInline
          preload="metadata"
          onMouseEnter={(e) => e.currentTarget.play()}
          onMouseLeave={(e) => {
            e.currentTarget.pause();
            e.currentTarget.currentTime = 0;
          }}
        />
      )}
      
      {/* Winner badge */}
      {showWinner && clip.winner && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#2EE6C9] flex items-center justify-center">
          <span className="text-xs">🏆</span>
        </div>
      )}
      
      {/* Killed overlay */}
      {clip.killed && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <span className="text-2xl">❌</span>
        </div>
      )}
      
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
    </button>
  );
}

// Batch Card Component
function BatchCard({ 
  batch, 
  onClipClick 
}: { 
  batch: BatchWithClips; 
  onClipClick: (index: number) => void;
}) {
  const readyClips = batch.clips.filter(c => c.status === "ready");
  const winnersCount = batch.clips.filter(c => c.winner).length;
  
  return (
    <div className="bg-[#1C2230] rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm text-white font-medium line-clamp-1">
            {batch.intent_text}
          </p>
          <p className="text-xs text-[#6B7280] mt-1">
            {readyClips.length} clips • {winnersCount} winners
          </p>
        </div>
        <span className={cn(
          "text-[10px] px-2 py-1 rounded uppercase tracking-wider",
          batch.status === "done" && "bg-[#2EE6C9]/20 text-[#2EE6C9]",
          batch.status === "running" && "bg-yellow-500/20 text-yellow-500",
          batch.status === "failed" && "bg-red-500/20 text-red-500"
        )}>
          {batch.status}
        </span>
      </div>
      
      {/* Clip previews */}
      <div className="grid grid-cols-5 gap-1">
        {batch.clips.slice(0, 5).map((clip, index) => (
          <button
            key={clip.id}
            onClick={() => clip.status === "ready" && onClipClick(index)}
            disabled={clip.status !== "ready"}
            className={cn(
              "aspect-[9/16] rounded overflow-hidden bg-[#0B0E11]",
              clip.status !== "ready" && "opacity-50"
            )}
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
          </button>
        ))}
      </div>
    </div>
  );
}
