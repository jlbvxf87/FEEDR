// FEEDR - Cost Tracking Utilities
// Estimates and tracks costs for AI service usage

export interface ServiceCostConfig {
  script: {
    openai: number;      // Cost per 1K tokens
    claude: number;
    mock: number;
  };
  voice: {
    elevenlabs: number;  // Cost per 1K characters
    openai: number;
    mock: number;
  };
  video: {
    sora: number;        // Cost per second of video
    runway: number;
    mock: number;
  };
  image: {
    dalle: number;       // Cost per image
    flux: number;
    midjourney: number;
    mock: number;
  };
  assembly: {
    ffmpeg: number;      // Cost per render
    mock: number;
  };
  research: {
    apify: number;       // Cost per search
    mock: number;
  };
}

// Estimated costs in cents
export const SERVICE_COSTS: ServiceCostConfig = {
  script: {
    openai: 3,    // ~$0.03 per script (GPT-4 Turbo)
    claude: 2,    // ~$0.02 per script (Claude Sonnet)
    mock: 0,
  },
  voice: {
    elevenlabs: 2,  // ~$0.02 per clip (Turbo v2)
    openai: 1,      // ~$0.01 per clip (TTS-1-HD)
    mock: 0,
  },
  video: {
    sora: 50,     // ~$0.50 per 15s video (estimate)
    runway: 25,   // ~$0.25 per 10s video (Gen-3 Turbo)
    mock: 0,
  },
  image: {
    dalle: 8,     // ~$0.08 per HD image (DALL-E 3)
    flux: 4,      // ~$0.04 per image (Flux 1.1 Pro via Replicate)
    midjourney: 6, // ~$0.06 per image (estimate)
    mock: 0,
  },
  assembly: {
    ffmpeg: 5,    // ~$0.05 per render (cloud service)
    mock: 0,
  },
  research: {
    apify: 10,    // ~$0.10 per search (~20 videos)
    mock: 0,
  },
};

/**
 * Estimate the cost of a batch in cents
 */
export function estimateBatchCost(
  batchSize: number,
  services: {
    script: string;
    voice: string;
    video: string;
    assembly: string;
  }
): number {
  const scriptCost = (SERVICE_COSTS.script[services.script as keyof typeof SERVICE_COSTS.script] || 0) * batchSize;
  const voiceCost = (SERVICE_COSTS.voice[services.voice as keyof typeof SERVICE_COSTS.voice] || 0) * batchSize;
  const videoCost = (SERVICE_COSTS.video[services.video as keyof typeof SERVICE_COSTS.video] || 0) * batchSize;
  const assemblyCost = (SERVICE_COSTS.assembly[services.assembly as keyof typeof SERVICE_COSTS.assembly] || 0) * batchSize;
  
  return scriptCost + voiceCost + videoCost + assemblyCost;
}

/**
 * Format cost in cents to display string
 */
export function formatCost(cents: number): string {
  if (cents === 0) return "Free";
  if (cents < 100) return `${cents}¢`;
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Calculate cost breakdown for a batch
 */
export function calculateCostBreakdown(
  batchSize: number,
  services: {
    script: string;
    voice: string;
    video: string;
    assembly: string;
  }
): {
  total: number;
  breakdown: { service: string; cost: number }[];
} {
  const breakdown = [
    { 
      service: `Scripts (${services.script})`, 
      cost: (SERVICE_COSTS.script[services.script as keyof typeof SERVICE_COSTS.script] || 0) * batchSize 
    },
    { 
      service: `Voice (${services.voice})`, 
      cost: (SERVICE_COSTS.voice[services.voice as keyof typeof SERVICE_COSTS.voice] || 0) * batchSize 
    },
    { 
      service: `Video (${services.video})`, 
      cost: (SERVICE_COSTS.video[services.video as keyof typeof SERVICE_COSTS.video] || 0) * batchSize 
    },
    { 
      service: `Assembly (${services.assembly})`, 
      cost: (SERVICE_COSTS.assembly[services.assembly as keyof typeof SERVICE_COSTS.assembly] || 0) * batchSize 
    },
  ];

  const total = breakdown.reduce((sum, item) => sum + item.cost, 0);

  return { total, breakdown };
}

/**
 * Get estimated costs for display based on current services
 */
export function getEstimatedCostsDisplay(): {
  perClip: string;
  perBatch5: string;
  perBatch10: string;
  perBatch15: string;
} {
  // Using mock services (free) by default
  // In production, these would be calculated from actual service config
  const mockServices = {
    script: "mock",
    voice: "mock",
    video: "mock",
    assembly: "mock",
  };

  return {
    perClip: formatCost(estimateBatchCost(1, mockServices)),
    perBatch5: formatCost(estimateBatchCost(5, mockServices)),
    perBatch10: formatCost(estimateBatchCost(10, mockServices)),
    perBatch15: formatCost(estimateBatchCost(15, mockServices)),
  };
}
