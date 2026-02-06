// FEEDR - KIE.AI Watermark Remover Service
// Removes Sora 2 watermarks from generated videos
// Docs: https://docs.kie.ai/market/sora2/sora-watermark-remover

const KIE_API_BASE = "https://api.kie.ai/api/v1";

// Max time to wait for watermark removal (30 seconds — typically takes 1-3s)
const MAX_POLL_MS = 30_000;
const POLL_INTERVAL_MS = 2_000;

export interface WatermarkRemovalResult {
  videoUrl: string;
}

/**
 * Remove watermark from a Sora-generated video using KIE.AI's dedicated remover.
 *
 * @param videoUrl - Publicly accessible URL of the video to clean
 * @param apiKey - KIE.AI API key (same key used for Sora generation)
 * @returns The cleaned video URL from KIE.AI
 */
export async function removeWatermark(
  videoUrl: string,
  apiKey: string,
): Promise<WatermarkRemovalResult> {
  console.log(`[Watermark] Submitting video for watermark removal...`);

  // 1. Submit watermark removal task
  const submitResponse = await fetch(`${KIE_API_BASE}/jobs/createTask`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sora-watermark-remover",
      input: {
        video_url: videoUrl,
      },
    }),
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text().catch(() => "unknown");
    throw new Error(`Watermark remover submit failed: ${submitResponse.status} - ${errorText}`);
  }

  const submitData = await submitResponse.json();
  const taskId = submitData.data?.taskId || submitData.data?.task_id;

  if (!taskId) {
    throw new Error(`Watermark remover response missing taskId: ${JSON.stringify(submitData)}`);
  }

  console.log(`[Watermark] Task created: ${taskId}`);

  // 2. Poll for completion (typically 1-3 seconds)
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLL_MS) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const statusResponse = await fetch(
      `${KIE_API_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
      {
        headers: { "Authorization": `Bearer ${apiKey}` },
      },
    );

    if (!statusResponse.ok) {
      console.warn(`[Watermark] Status check failed: ${statusResponse.status}, retrying...`);
      continue;
    }

    const statusData = await statusResponse.json();
    const state = statusData.data?.state || statusData.state;

    if (state === "success") {
      // Extract cleaned video URL from result
      const resultUrls = statusData.data?.resultJson?.resultUrls
        || statusData.data?.resultUrls
        || statusData.resultUrls;

      const cleanedUrl = Array.isArray(resultUrls) && resultUrls.length > 0
        ? resultUrls[0]
        : statusData.data?.resultJson?.video_url
          || statusData.data?.video_url;

      if (!cleanedUrl) {
        throw new Error(`Watermark removal completed but no video URL in response: ${JSON.stringify(statusData)}`);
      }

      console.log(`[Watermark] Video cleaned successfully`);
      return { videoUrl: cleanedUrl };
    }

    if (state === "fail" || state === "failed" || state === "error") {
      const failMsg = statusData.data?.failMsg || statusData.data?.error || "Unknown error";
      throw new Error(`Watermark removal failed: ${failMsg}`);
    }

    // Still processing — continue polling
  }

  throw new Error(`Watermark removal timed out after ${MAX_POLL_MS / 1000}s for task ${taskId}`);
}
