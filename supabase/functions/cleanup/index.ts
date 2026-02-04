// FEEDR - Storage Cleanup Edge Function
// Automatically cleans up old/killed clips and their files

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClipForCleanup {
  clip_id: string;
  reason: string;
  voice_url: string | null;
  raw_video_url: string | null;
  final_url: string | null;
  image_url: string | null;
}

interface CleanupResult {
  success: boolean;
  clips_processed: number;
  files_deleted: number;
  errors: string[];
  duration_ms: number;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const errors: string[] = [];
  let filesDeleted = 0;
  let clipsProcessed = 0;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if cleanup is enabled
    const { data: settings } = await supabase
      .from("retention_settings")
      .select("setting_value")
      .eq("setting_key", "cleanup_enabled")
      .single();

    if (settings?.setting_value !== "true") {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Cleanup is disabled",
          clips_processed: 0,
          files_deleted: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get clips ready for cleanup
    const { data: clipsToClean, error: fetchError } = await supabase
      .rpc("get_clips_for_cleanup");

    if (fetchError) {
      throw new Error(`Failed to fetch clips: ${fetchError.message}`);
    }

    if (!clipsToClean || clipsToClean.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No clips to clean up",
          clips_processed: 0,
          files_deleted: 0,
          duration_ms: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${clipsToClean.length} clips to clean up`);

    // Process each clip
    const clipIds: string[] = [];
    
    for (const clip of clipsToClean as ClipForCleanup[]) {
      clipIds.push(clip.clip_id);
      
      // Delete files from storage
      const urlsToDelete = [
        clip.voice_url,
        clip.raw_video_url,
        clip.final_url,
        clip.image_url,
      ].filter(Boolean);

      for (const url of urlsToDelete) {
        try {
          const deleted = await deleteFileFromUrl(supabase, url!);
          if (deleted) filesDeleted++;
        } catch (e) {
          errors.push(`Failed to delete ${url}: ${e}`);
        }
      }
    }

    // Mark clips as deleted in database
    if (clipIds.length > 0) {
      const { data: updateResult, error: updateError } = await supabase
        .rpc("mark_clips_deleted", { clip_ids: clipIds });

      if (updateError) {
        errors.push(`Failed to mark clips deleted: ${updateError.message}`);
      } else {
        clipsProcessed = updateResult || clipIds.length;
      }
    }

    // Log the cleanup operation
    await supabase.from("cleanup_log").insert({
      clips_deleted: clipsProcessed,
      files_deleted: filesDeleted,
      bytes_freed: 0, // Would need file size tracking
      details: {
        reasons: clipsToClean.reduce((acc: Record<string, number>, c: ClipForCleanup) => {
          acc[c.reason] = (acc[c.reason] || 0) + 1;
          return acc;
        }, {}),
        errors: errors.slice(0, 10), // Limit logged errors
      },
    });

    const result: CleanupResult = {
      success: errors.length === 0,
      clips_processed: clipsProcessed,
      files_deleted: filesDeleted,
      errors: errors.slice(0, 5),
      duration_ms: Date.now() - startTime,
    };

    console.log(`Cleanup complete: ${clipsProcessed} clips, ${filesDeleted} files`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error",
        clips_processed: clipsProcessed,
        files_deleted: filesDeleted,
        duration_ms: Date.now() - startTime,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Delete a file from Supabase storage given its public URL
 */
async function deleteFileFromUrl(
  supabase: ReturnType<typeof createClient>,
  url: string
): Promise<boolean> {
  try {
    // Parse the URL to extract bucket and path
    // URL format: https://xxx.supabase.co/storage/v1/object/public/BUCKET/PATH
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/storage/v1/object/public/");
    
    if (pathParts.length !== 2) {
      console.log(`Skipping non-storage URL: ${url}`);
      return false;
    }
    
    const [bucket, ...pathSegments] = pathParts[1].split("/");
    const path = pathSegments.join("/");
    
    if (!bucket || !path) {
      console.log(`Could not parse bucket/path from: ${url}`);
      return false;
    }
    
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);
    
    if (error) {
      console.error(`Delete failed for ${bucket}/${path}:`, error);
      return false;
    }
    
    console.log(`Deleted: ${bucket}/${path}`);
    return true;
    
  } catch (e) {
    console.error(`Error deleting ${url}:`, e);
    return false;
  }
}
