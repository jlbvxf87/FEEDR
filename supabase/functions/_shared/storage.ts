// FEEDR - Supabase Storage Helpers
// Utilities for uploading and managing files in storage buckets

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

export type StorageBucket = "assets" | "voice" | "raw" | "final" | "previews";

export interface UploadResult {
  path: string;
  publicUrl: string;
}

/**
 * Get a Supabase client with service role key
 */
export function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadToStorage(
  bucket: StorageBucket,
  path: string,
  file: Blob | ArrayBuffer | Uint8Array,
  contentType?: string
): Promise<UploadResult> {
  const supabase = getSupabaseClient();
  
  // Convert ArrayBuffer/Uint8Array to Blob if needed
  let uploadFile: Blob;
  if (file instanceof Blob) {
    uploadFile = file;
  } else if (file instanceof ArrayBuffer) {
    uploadFile = new Blob([file], { type: contentType });
  } else {
    uploadFile = new Blob([file], { type: contentType });
  }
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, uploadFile, {
      contentType,
      upsert: true,
    });
  
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);
  
  return {
    path: data.path,
    publicUrl: urlData.publicUrl,
  };
}

/**
 * Upload audio file (MP3/WAV)
 */
export async function uploadAudio(
  clipId: string,
  audioData: ArrayBuffer | Blob
): Promise<string> {
  const path = `${clipId}.mp3`;
  const result = await uploadToStorage("voice", path, audioData, "audio/mpeg");
  return result.publicUrl;
}

/**
 * Upload video file (MP4)
 */
export async function uploadVideo(
  bucket: "raw" | "final",
  clipId: string,
  videoData: ArrayBuffer | Blob
): Promise<string> {
  const path = `${clipId}.mp4`;
  const result = await uploadToStorage(bucket, path, videoData, "video/mp4");
  return result.publicUrl;
}

/**
 * Download file from URL
 */
export async function downloadFile(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }
  return response.arrayBuffer();
}

/**
 * Delete file from storage
 */
export async function deleteFromStorage(
  bucket: StorageBucket,
  path: string
): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);
  
  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`);
  }
}

/**
 * Generate a signed URL for temporary access
 */
export async function getSignedUrl(
  bucket: StorageBucket,
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  
  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }
  
  return data.signedUrl;
}
