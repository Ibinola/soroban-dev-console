/**
 * Duplicate-run protection for scheduled jobs (#1382).
 *
 * Every schedule has a stable key (e.g. `backup:sqlite:interval-60`). At most
 * one run per key may be active; a second trigger while one is running is
 * skipped, and once the active run finishes (success or failure) the next
 * trigger is allowed. Keys and outcomes go to the log callback so operators can
 * see what was deduplicated.
 *
 * In-process only: it guards against repeated scheduler triggers and concurrent
 * callers in one API instance, not against several instances.
 */

export type ScheduleOutcome = "started" | "skipped_active" | "completed" | "failed";

export interface ScheduleLogEvent {
  dedupeKey: string;
  outcome: ScheduleOutcome;
  /** Milliseconds the run took (completed/failed only). */
  durationMs?: number;
  /** Error message (failed only). */
  error?: string;
}

export type ScheduleRunResult<T> =
  | { status: "ran"; value: T }
  | { status: "skipped"; reason: "active_run_in_progress" };

export class ScheduleGate {
  private readonly active = new Map<string, number>();

  constructor(
    private readonly log: (event: ScheduleLogEvent) => void = () => {},
    private readonly now: () => number = Date.now,
  ) {}

  isActive(dedupeKey: string): boolean {
    return this.active.has(dedupeKey);
  }

  /** Run `task` unless a run for `dedupeKey` is already active. Failures propagate after the key is released. */
  async runOnce<T>(dedupeKey: string, task: () => Promise<T>): Promise<ScheduleRunResult<T>> {
    if (this.active.has(dedupeKey)) {
      this.log({ dedupeKey, outcome: "skipped_active" });
      return { status: "skipped", reason: "active_run_in_progress" };
    }
    // Claimed synchronously, before the first await, so concurrent callers cannot both pass.
    const startedAt = this.now();
    this.active.set(dedupeKey, startedAt);
    this.log({ dedupeKey, outcome: "started" });
    try {
      const value = await task();
      this.log({ dedupeKey, outcome: "completed", durationMs: this.now() - startedAt });
      return { status: "ran", value };
    } catch (error) {
      this.log({
        dedupeKey,
        outcome: "failed",
        durationMs: this.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      this.active.delete(dedupeKey);
    }
  }
}
