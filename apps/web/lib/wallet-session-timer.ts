/**
 * Track wallet session countdown and auto-disconnect timing. (#907)
 */
export const SESSION_MAX_DURATION_MS = 8 * 60 * 60 * 1000;

export function computeSessionRemainingMs(connectedAt: number, now: number = Date.now()): number {
  const elapsed = now - connectedAt;
  return Math.max(SESSION_MAX_DURATION_MS - elapsed, 0);
}

export function isSessionExpired(connectedAt: number, now: number = Date.now()): boolean {
  return computeSessionRemainingMs(connectedAt, now) === 0;
}

export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
}
