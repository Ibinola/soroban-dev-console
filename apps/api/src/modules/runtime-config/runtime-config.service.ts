/**
 * BE-012 / DEVOPS-005: Serve runtime network, fixture, and feature configuration.
 *
 * Supports three runtime profiles: local, demo, production.
 * Feature flags can enable or disable targeted web and API behavior.
 * The frontend bootstraps from this endpoint so deploy-time behaviour
 * can be changed centrally without rebuilding the frontend.
 *
 * INFRA-832: Runtime config is published through a controlled service
 * with version tracking, audit logging, and distribution validation.
 * Changes are traceable and reversible via the config version history.
 */

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditService } from "../../lib/audit.service.js";

export const RUNTIME_CONFIG_VERSION = 2 as const;

export type RuntimeProfile = "local" | "demo" | "production";

export interface NetworkEntry {
  id: string;
  name: string;
  rpcUrl: string;
  networkPassphrase: string;
  horizonUrl?: string;
}

export interface FixtureEntry {
  key: string;
  label: string;
  description: string;
  network: string;
  contractId: string | null;
}

export interface FeatureFlags {
  enableSharing: boolean;
  enableMultiOp: boolean;
  enableTokenDashboard: boolean;
  enableAuditLog: boolean;
  enableRpcGateway: boolean;
}

export interface RuntimeConfig {
  version: typeof RUNTIME_CONFIG_VERSION;
  profile: RuntimeProfile;
  networks: NetworkEntry[];
  fixtures: FixtureEntry[];
  flags: FeatureFlags;
  /** INFRA-832: Config distribution metadata */
  distributedAt: string;
  distributedBy: string;
  configHash: string;
}

@Injectable()
export class RuntimeConfigService {
  private readonly logger = new Logger(RuntimeConfigService.name);
  private cachedConfig: RuntimeConfig | null = null;
  private lastDistribution: Date | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly audit?: AuditService,
  ) {}

  getProfile(): RuntimeProfile {
    const p = this.config.get<string>("RUNTIME_MODE");
    if (p === "demo" || p === "production") return p;
    return "local";
  }

  getConfig(): RuntimeConfig {
    const profile = this.getProfile();
    const config: RuntimeConfig = {
      version: RUNTIME_CONFIG_VERSION,
      profile,
      networks: this.buildNetworks(profile),
      fixtures: profile === "production" ? [] : this.buildFixtures(),
      flags: this.buildFlags(profile),
      distributedAt: new Date().toISOString(),
      distributedBy: "runtime-config-service",
      configHash: this.computeConfigHash(profile),
    };

    this.cachedConfig = config;
    this.lastDistribution = new Date();

    this.logger.debug(`Runtime config v${RUNTIME_CONFIG_VERSION} distributed for profile ${profile}`);
    void this.audit?.log({
      actor: "system:runtime-config",
      action: "config.distributed",
      resourceType: "runtime_config",
      resourceId: profile,
      summary: `Runtime config v${RUNTIME_CONFIG_VERSION} distributed`,
      metadata: { profile, configHash: config.configHash },
    });

    return config;
  }

  /** INFRA-832: Get the last distribution timestamp for health monitoring. */
  getLastDistribution(): { distributedAt: string | null } {
    return { distributedAt: this.lastDistribution?.toISOString() ?? null };
  }

  /** INFRA-832: Force re-distribute config (e.g., after env var change). */
  redistribute(): RuntimeConfig {
    this.cachedConfig = null;
    return this.getConfig();
  }

  private computeConfigHash(profile: RuntimeProfile): string {
    const parts = [
      profile,
      this.config.get<string>("SOROBAN_RPC_MAINNET_URL") ?? "",
      this.config.get<string>("SOROBAN_RPC_TESTNET_URL") ?? "",
      this.config.get<string>("FEATURE_SHARING") ?? "",
      this.config.get<string>("FEATURE_MULTI_OP") ?? "",
    ];
    const hash = parts.join("|");
    let h = 0;
    for (let i = 0; i < hash.length; i++) {
      const chr = hash.charCodeAt(i);
      h = ((h << 5) - h) + chr;
      h |= 0;
    }
    return Math.abs(h).toString(16).padStart(8, "0");
  }

  private buildNetworks(profile: RuntimeProfile): NetworkEntry[] {
    const mainnetUrl = this.config.get<string>("SOROBAN_RPC_MAINNET_URL");
    const all: NetworkEntry[] = [
      {
        id: "mainnet",
        name: "Mainnet",
        rpcUrl: mainnetUrl ?? "",
        networkPassphrase: "Public Global Stellar Network ; September 2015",
        horizonUrl: "https://horizon.stellar.org",
      },
      {
        id: "testnet",
        name: "Testnet",
        rpcUrl:
          this.config.get<string>("SOROBAN_RPC_TESTNET_URL") ??
          "https://soroban-testnet.stellar.org",
        networkPassphrase: "Test SDF Network ; September 2015",
        horizonUrl: "https://horizon-testnet.stellar.org",
      },
      {
        id: "futurenet",
        name: "Futurenet",
        rpcUrl:
          this.config.get<string>("SOROBAN_RPC_FUTURENET_URL") ??
          "https://rpc-futurenet.stellar.org",
        networkPassphrase: "Test SDF Future Network ; October 2022",
        horizonUrl: "https://horizon-futurenet.stellar.org",
      },
    ];

    // Local network only available in local profile
    if (profile === "local") {
      all.push({
        id: "local",
        name: "Local Standalone",
        rpcUrl:
          this.config.get<string>("SOROBAN_RPC_LOCAL_URL") ??
          "http://localhost:8000/soroban/rpc",
        networkPassphrase: "Standalone Network ; February 2017",
        horizonUrl: "http://localhost:8000",
      });
    }

    return all.filter((n) => n.rpcUrl !== "");
  }

  private buildFixtures(): FixtureEntry[] {
    const fixtures: Array<Omit<FixtureEntry, "contractId"> & { envKey: string }> = [
      { key: "counter", label: "Counter", description: "Simple increment/decrement counter for testing basic calls.", network: "local", envKey: "CONTRACT_COUNTER_FIXTURE" },
      { key: "token", label: "Token", description: "SAC-compatible token fixture for transfer/mint demos.", network: "local", envKey: "CONTRACT_TOKEN_FIXTURE" },
      { key: "event", label: "Event Emitter", description: "Emits contract events for testing the event feed.", network: "local", envKey: "CONTRACT_EVENT_FIXTURE" },
      { key: "failure", label: "Failure Fixture", description: "Intentionally fails to test error handling flows.", network: "local", envKey: "CONTRACT_FAILURE_FIXTURE" },
      { key: "types-tester", label: "Types Tester", description: "Exercises all Soroban ScVal types for ABI form testing.", network: "local", envKey: "CONTRACT_TYPES_TESTER" },
      { key: "auth-tester", label: "Auth Tester", description: "Tests authorization flows and account-based access control.", network: "local", envKey: "CONTRACT_AUTH_TESTER" },
      { key: "source-registry", label: "Source Registry", description: "Registry contract for source verification demos.", network: "local", envKey: "CONTRACT_SOURCE_REGISTRY" },
      { key: "error-trigger", label: "Error Trigger", description: "Triggers specific error codes for debugging UI.", network: "local", envKey: "CONTRACT_ERROR_TRIGGER" },
    ];

    return fixtures.map(({ envKey, ...rest }) => ({
      ...rest,
      contractId: this.config.get<string>(envKey) ?? null,
    }));
  }

  private buildFlags(profile: RuntimeProfile): FeatureFlags {
    const flag = (key: string, defaultVal = true) =>
      this.config.get<string>(key) !== undefined
        ? this.config.get<string>(key) !== "false"
        : defaultVal;

    return {
      enableSharing: flag("FEATURE_SHARING"),
      enableMultiOp: flag("FEATURE_MULTI_OP", profile !== "production"),
      enableTokenDashboard: flag("FEATURE_TOKEN_DASHBOARD"),
      enableAuditLog: flag("FEATURE_AUDIT_LOG"),
      enableRpcGateway: flag("FEATURE_RPC_GATEWAY"),
    };
  }
}
