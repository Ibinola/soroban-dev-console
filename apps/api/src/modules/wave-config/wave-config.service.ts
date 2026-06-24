/**
 * INFRA-214: Feature-flag and config distribution service for Wave controls.
 *
 * Provides a single source of truth for Wave 5 feature flags and runtime controls.
 * - Flags are backed by environment variables for deploy-time control
 * - Operator overrides are stored in-memory (survive restarts via env vars)
 * - Each flag includes a rollout percentage for gradual enablement
 * - All flag changes are audit-logged for observability
 *
 * Compatible with the current deployment model: no external store required.
 * Operators can observe state via GET /wave-config/flags and override via PATCH.
 */

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditService } from "../../lib/audit.service.js";
import type {
  WaveFeatureKey,
  WaveFeatureFlag,
  WaveRuntimeControls,
  SetFeatureFlagPayload,
} from "@devconsole/api-contracts";

const ALL_KEYS: WaveFeatureKey[] = [
  "wave5_ai_appeals",
  "wave5_budget_accounting",
  "wave5_contributor_verification",
  "wave5_point_ledger",
  "wave5_notifications",
  "wave5_review_context",
  "wave5_data_retention",
];

@Injectable()
export class WaveConfigService {
  private readonly logger = new Logger(WaveConfigService.name);
  private readonly overrides = new Map<WaveFeatureKey, WaveFeatureFlag>();
  private version = 1;

  constructor(
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  getControls(): WaveRuntimeControls {
    return {
      flags: ALL_KEYS.map((k) => this.resolveFlag(k)),
      version: this.version,
      generatedAt: new Date().toISOString(),
    };
  }

  getFlag(key: WaveFeatureKey): WaveFeatureFlag {
    return this.resolveFlag(key);
  }

  setFlag(key: WaveFeatureKey, payload: SetFeatureFlagPayload): WaveFeatureFlag {
    const existing = this.resolveFlag(key);
    const updated: WaveFeatureFlag = {
      key,
      enabled: payload.enabled,
      rolloutPercent: payload.rolloutPercent ?? existing.rolloutPercent,
      overriddenBy: payload.overriddenBy ?? null,
      updatedAt: new Date().toISOString(),
    };
    this.overrides.set(key, updated);
    this.version++;

    void this.audit.log({
      actor: payload.overriddenBy ?? "system",
      action: "wave_config.flag.set",
      resourceType: "wave_feature_flag",
      resourceId: key,
      summary: `Flag "${key}" set to enabled=${payload.enabled} rollout=${updated.rolloutPercent}%`,
      metadata: { key, enabled: payload.enabled, rolloutPercent: updated.rolloutPercent },
    });

    this.logger.log(`Flag "${key}" updated: enabled=${updated.enabled} rollout=${updated.rolloutPercent}%`);
    return updated;
  }

  /**
   * Check whether a given flag is active for a specific contributor.
   * Uses rolloutPercent for deterministic bucketing.
   */
  isEnabled(key: WaveFeatureKey, contributorId?: string): boolean {
    const flag = this.resolveFlag(key);
    if (!flag.enabled) return false;
    if (flag.rolloutPercent >= 100) return true;
    if (!contributorId) return false;
    // Deterministic bucket: hash last 2 chars of ID to 0-99
    const bucket = parseInt(contributorId.slice(-2), 16) % 100;
    return bucket < flag.rolloutPercent;
  }

  private resolveFlag(key: WaveFeatureKey): WaveFeatureFlag {
    if (this.overrides.has(key)) return this.overrides.get(key)!;
    return this.fromEnv(key);
  }

  private fromEnv(key: WaveFeatureKey): WaveFeatureFlag {
    const envKey = `WAVE_FLAG_${key.toUpperCase()}`;
    const rolloutKey = `WAVE_ROLLOUT_${key.toUpperCase()}`;

    const rawEnabled = this.config.get<string>(envKey);
    const rawRollout = this.config.get<string>(rolloutKey);

    const enabled = rawEnabled !== undefined ? rawEnabled !== "false" : true;
    const rolloutPercent = rawRollout ? Math.min(100, Math.max(0, parseInt(rawRollout, 10))) : 100;

    return {
      key,
      enabled,
      rolloutPercent,
      overriddenBy: null,
      updatedAt: new Date(0).toISOString(),
    };
  }
}
