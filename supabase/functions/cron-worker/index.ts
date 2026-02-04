// FEEDR - Cron Worker Edge Function
// This function is triggered by a cron job to process queued jobs AND run cleanup
// Configure in Supabase Dashboard: Database > Extensions > pg_cron

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Maximum jobs to process per invocation
const MAX_JOBS_PER_RUN = 10;

// Maximum time (ms) to process jobs per invocation
const MAX_RUNTIME_MS = 55000; // 55 seconds (leave buffer for function timeout)

// Run cleanup every N cron executions (e.g., every hour if cron runs every minute)
const CLEANUP_INTERVAL = 60;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let processedCount = 0;
  const results: { job_id: string; type: string; status: string }[] = [];
  let cleanupResult = null;

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Process jobs until we hit limits
    while (processedCount < MAX_JOBS_PER_RUN && (Date.now() - startTime) < MAX_RUNTIME_MS) {
      // Invoke the worker function
      const { data, error } = await supabase.functions.invoke("worker", {
        body: { action: "run-once" },
      });

      if (error) {
        console.error("Worker invocation error:", error);
        break;
      }

      if (!data.processed) {
        // No more jobs to process
        break;
      }

      processedCount++;
      results.push({
        job_id: data.job_id,
        type: data.job_type,
        status: "processed",
      });

      // Small delay between jobs to avoid overwhelming services
      await new Promise(r => setTimeout(r, 100));
    }

    // Run cleanup every 10 minutes (on minutes 0, 10, 20, 30, 40, 50)
    const currentMinute = new Date().getMinutes();
    if (currentMinute % 10 === 0) {
      try {
        const { data: cleanupData, error: cleanupError } = await supabase.functions.invoke("cleanup", {
          body: {},
        });
        
        if (cleanupError) {
          console.error("Cleanup error:", cleanupError);
        } else {
          cleanupResult = cleanupData;
          console.log("Cleanup completed:", cleanupData);
        }
      } catch (e) {
        console.error("Cleanup invocation failed:", e);
      }
    }
    
    // Quick stuck job check on every run (lightweight)
    const stuckThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: stuckJobs } = await supabase
      .from("jobs")
      .update({ status: "queued", error: "Reset: stuck job" })
      .eq("status", "running")
      .lt("created_at", stuckThreshold)
      .select("id");
    
    if (stuckJobs && stuckJobs.length > 0) {
      console.log(`Reset ${stuckJobs.length} stuck jobs`);
    }

    const elapsed = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        jobs_processed: processedCount,
        elapsed_ms: elapsed,
        results,
        cleanup: cleanupResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Cron worker error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        jobs_processed: processedCount,
        results,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
