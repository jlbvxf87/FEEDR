import { createClient } from "./supabaseBrowser";
import type {
  Preset,
  Batch,
  Clip,
  GenerateBatchRequest,
  GenerateBatchResponse,
} from "./types";

const supabase = createClient();

// Presets
export async function getActivePresets(): Promise<Preset[]> {
  const { data, error } = await supabase
    .from("presets")
    .select("*")
    .eq("is_active", true)
    .order("key");

  if (error) throw error;
  return data || [];
}

// Batches
export async function getLatestBatch(): Promise<Batch | null> {
  const { data, error } = await supabase
    .from("batches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function getBatch(id: string): Promise<Batch | null> {
  const { data, error } = await supabase
    .from("batches")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

// Clips
export async function getClipsForBatch(batchId: string): Promise<Clip[]> {
  const { data, error } = await supabase
    .from("clips")
    .select("*")
    .eq("batch_id", batchId)
    .order("variant_id");

  if (error) throw error;
  return data || [];
}

export async function updateClip(
  clipId: string,
  updates: Partial<Pick<Clip, "winner" | "killed">>
): Promise<Clip> {
  const { data, error } = await supabase
    .from("clips")
    .update(updates)
    .eq("id", clipId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function toggleWinner(clipId: string, winner: boolean): Promise<Clip> {
  return updateClip(clipId, { winner });
}

export async function toggleKilled(clipId: string, killed: boolean): Promise<Clip> {
  return updateClip(clipId, { killed });
}

// Recent winners
export async function getRecentWinners(limit: number = 6): Promise<Clip[]> {
  const { data, error } = await supabase
    .from("clips")
    .select("*")
    .eq("winner", true)
    .or("ui_state.eq.ready,status.eq.ready")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Generate batch - calls edge function
export async function generateBatch(
  request: GenerateBatchRequest
): Promise<GenerateBatchResponse> {
  const { data, error } = await supabase.functions.invoke("generate-batch", {
    body: request,
  });

  if (error) throw error;
  return data;
}

// Run worker - dev mode only
export async function runWorkerOnce(): Promise<{ processed: boolean }> {
  const { data, error } = await supabase.functions.invoke("worker", {
    body: { action: "run-once" },
  });

  if (error) throw error;
  return data;
}

// Realtime subscription helper
export function subscribeToClips(
  batchId: string,
  callback: (clip: Clip) => void
) {
  return supabase
    .channel(`clips:${batchId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "clips",
        filter: `batch_id=eq.${batchId}`,
      },
      (payload) => {
        callback(payload.new as Clip);
      }
    )
    .subscribe();
}

export function subscribeToBatch(
  batchId: string,
  callback: (batch: Batch) => void
) {
  return supabase
    .channel(`batch:${batchId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "batches",
        filter: `id=eq.${batchId}`,
      },
      (payload) => {
        callback(payload.new as Batch);
      }
    )
    .subscribe();
}

// Get signed URL for download
export async function getSignedDownloadUrl(
  bucket: string,
  path: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  if (error) throw error;
  return data.signedUrl;
}
