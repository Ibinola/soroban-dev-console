/**
 * AI-209: Model rollback and safe rollout controls for appeal automation.
 *
 * Provides guarded rollout modes (pinned, canary, full) so AI behaviour can be
 * promoted incrementally and rolled back instantly if fairness or quality metrics
 * drift. All transitions are explicit, logged, and reversible.
 *
 * Explicit inputs  → setRollout(config) / resolveModel(context)
 * Explicit outputs → RolloutResolution (modelVersion, mode, reason)
 * Review boundary  → canary mode routes only the configured % of traffic to the
 *                    candidate; humans monitor before promoting to "full"
 */

import { Injectable, Logger } from "@nestjs/common";

export type RolloutMode = "pinned" | "canary" | "full";

export interface RolloutConfig {
  /** The model version to use in "pinned" and "full" modes, and as canary candidate. */
  activeVersion: string;
  /** The stable fallback version used when not in "full" mode or when canary misses. */
  stableVersion: string;
  mode: RolloutMode;
  /**
   * In "canary" mode: percentage of requests routed to activeVersion (0–100).
   * Ignored in other modes.
   */
  canaryPercent?: number;
}

export interface RolloutResolution {
  modelVersion: string;
  mode: RolloutMode;
  /** Human-readable reason for the routing decision (for logs / operator inspection). */
  reason: string;
}

export interface ModelRolloutState {
  current: RolloutConfig;
  previous: RolloutConfig | null;
  updatedAt: string;
}

const DEFAULT_CONFIG: RolloutConfig = {
  activeVersion: "v1",
  stableVersion: "v1",
  mode: "pinned",
  canaryPercent: 0,
};

@Injectable()
export class ModelRolloutService {
  private readonly logger = new Logger(ModelRolloutService.name);

  private state: ModelRolloutState = {
    current: { ...DEFAULT_CONFIG },
    previous: null,
    updatedAt: new Date().toISOString(),
  };

  /** Inspect the current rollout state (for operator dashboards / runbooks). */
  getState(): ModelRolloutState {
    return { ...this.state };
  }

  /**
   * Update the rollout configuration.
   * The previous config is preserved so rollback() can restore it instantly.
   */
  setRollout(config: RolloutConfig): ModelRolloutState {
    const previous = this.state.current;
    this.state = { current: config, previous, updatedAt: new Date().toISOString() };

    this.logger.log(
      JSON.stringify({
        event: "rollout_config_updated",
        mode: config.mode,
        activeVersion: config.activeVersion,
        stableVersion: config.stableVersion,
        canaryPercent: config.canaryPercent ?? 0,
      }),
    );

    return this.getState();
  }

  /**
   * Roll back to the previous configuration immediately.
   * No-op if there is no previous config (already at stable baseline).
   */
  rollback(): ModelRolloutState {
    if (!this.state.previous) {
      this.logger.warn("rollback requested but no previous config exists — no-op");
      return this.getState();
    }

    const restored = this.state.previous;
    this.state = {
      current: restored,
      previous: null,
      updatedAt: new Date().toISOString(),
    };

    this.logger.warn(
      JSON.stringify({
        event: "rollout_rolled_back",
        restoredVersion: restored.activeVersion,
        restoredMode: restored.mode,
      }),
    );

    return this.getState();
  }

  /**
   * Resolve which model version to use for a given request context.
   *
   * @param requestId  Used as entropy source for canary bucketing (deterministic per request).
   */
  resolveModel(requestId: string): RolloutResolution {
    const { mode, activeVersion, stableVersion, canaryPercent = 0 } = this.state.current;

    if (mode === "pinned") {
      return {
        modelVersion: stableVersion,
        mode,
        reason: `pinned to stable version ${stableVersion}`,
      };
    }

    if (mode === "full") {
      return {
        modelVersion: activeVersion,
        mode,
        reason: `full rollout of ${activeVersion}`,
      };
    }

    // canary — deterministic bucketing via simple hash of requestId
    const bucket = this.hashBucket(requestId, 100);
    if (bucket < canaryPercent) {
      return {
        modelVersion: activeVersion,
        mode,
        reason: `canary bucket ${bucket} < ${canaryPercent}% → candidate ${activeVersion}`,
      };
    }

    return {
      modelVersion: stableVersion,
      mode,
      reason: `canary bucket ${bucket} ≥ ${canaryPercent}% → stable ${stableVersion}`,
    };
  }

  /** Deterministic integer bucket [0, modulus) derived from a string. */
  private hashBucket(input: string, modulus: number): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
    }
    return hash % modulus;
  }
}
