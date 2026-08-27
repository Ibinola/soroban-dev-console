/**
 * Compute transaction timebounds from a preset or custom duration. (#903)
 */
export interface Timebounds {
  minTime: number;
  maxTime: number;
}

export const TIMEBOUND_PRESETS: Record<string, number> = {
  "5 minutes": 5 * 60,
  "15 minutes": 15 * 60,
  "1 hour": 60 * 60,
};

export function computeTimebounds(durationSeconds: number, now: number = Date.now()): Timebounds {
  const nowSeconds = Math.floor(now / 1000);
  return {
    minTime: nowSeconds,
    maxTime: nowSeconds + durationSeconds,
  };
}

export function hasExpired(bounds: Timebounds, now: number = Date.now()): boolean {
  return Math.floor(now / 1000) > bounds.maxTime;
}
