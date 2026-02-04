import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatVariantId(index: number): string {
  return `V${String(index + 1).padStart(2, "0")}`;
}

export function getStatusStep(status: string): number {
  const steps: Record<string, number> = {
    planned: 0,
    scripting: 1,
    vo: 2,
    rendering: 3,
    assembling: 4,
    ready: 5,
    failed: -1,
  };
  return steps[status] ?? 0;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
