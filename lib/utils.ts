import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatVariantId(index: number): string {
  return `V${String(index + 1).padStart(2, "0")}`;
}

export function normalizeUIState(uiState?: string | null, status?: string | null): string {
  if (uiState) return uiState;
  return status || "queued";
}

export function getStatusStep(status: string): number {
  const steps: Record<string, number> = {
    queued: 0,
    writing: 1,
    voicing: 2,
    submitting: 3,
    rendering: 3,
    rendering_delayed: 3,
    assembling: 4,
    ready: 5,
    failed_not_charged: -1,
    failed_charged: -1,
    canceled: -1,
    planned: 0,
    scripting: 1,
    vo: 2,
    generating: 3,
    failed: -1,
  };
  return steps[status] ?? 0;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
