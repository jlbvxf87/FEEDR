// FEEDR - Research Edge Function
// POST /functions/v1/research

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { getServices } from "../_shared/services/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResearchRequest {
  query: string;
  platform?: "tiktok" | "instagram" | "youtube" | "all";
  limit?: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const body: ResearchRequest = await req.json();
    const { query, platform = "tiktok", limit = 20 } = body;

    if (!query?.trim()) {
      return new Response(
        JSON.stringify({ error: "query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get research service
    const services = getServices();
    const researchService = services.getResearchService();

    // 1. Create research query record
    const { data: research, error: createError } = await supabase
      .from("research_queries")
      .insert({
        user_id: user.id,
        query_text: query,
        platform,
        status: "scraping",
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create research: ${createError.message}`);
    }

    try {
      // 2. Scrape videos
      console.log(`Scraping ${platform} for: ${query}`);
      const videos = await researchService.searchVideos({
        query,
        platform,
        limit,
        sort_by: "views",
      });

      // 3. Store scraped videos
      if (videos.length > 0) {
        const { error: insertError } = await supabase
          .from("scraped_videos")
          .insert(
            videos.map(v => ({
              research_id: research.id,
              platform: v.platform,
              video_id: v.id,
              video_url: v.url,
              author_username: v.author_username,
              caption: v.caption,
              transcript: v.transcript,
              views: v.views,
              likes: v.likes,
              comments: v.comments,
              shares: v.shares,
              hashtags: v.hashtags,
              hook_text: v.hook_text,
              duration_seconds: v.duration_seconds,
            }))
          );

        if (insertError) {
          console.warn("Failed to insert some videos:", insertError);
        }
      }

      // 4. Update status to analyzing
      await supabase
        .from("research_queries")
        .update({ 
          status: "analyzing",
          videos_found: videos.length,
          results_json: videos,
        })
        .eq("id", research.id);

      // 5. Analyze with Clawdbot
      console.log(`Analyzing ${videos.length} videos with Clawdbot`);
      const analysis = await researchService.analyzeVideos(query, videos);

      // 6. Store final results
      await supabase
        .from("research_queries")
        .update({
          status: "complete",
          analysis_json: analysis,
        })
        .eq("id", research.id);

      // Log service usage
      await supabase.from("service_logs").insert({
        service_type: "research",
        service_name: researchService.name,
        metadata_json: { query, platform, videos_found: videos.length },
      });

      return new Response(
        JSON.stringify({
          research_id: research.id,
          videos_found: videos.length,
          analysis,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (processError: any) {
      // Mark research as failed
      await supabase
        .from("research_queries")
        .update({
          status: "failed",
          error: processError.message,
        })
        .eq("id", research.id);

      throw processError;
    }

  } catch (error: any) {
    console.error("Error in research:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
