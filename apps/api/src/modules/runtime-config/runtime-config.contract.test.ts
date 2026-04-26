/**
 * BE-018: Typed contract tests for runtime-config API payload
 * 
 * Validates that the runtime-config endpoint returns payloads that match the shared contracts
 * and prevents silent schema drift between backend and frontend.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { RuntimeConfigService } from "./runtime-config.service.js";
import { ConfigService } from "@nestjs/config";
import {
  RUNTIME_CONFIG_VERSION,
  RuntimeConfig,
  RuntimeProfile,
  RuntimeNetworkEntry,
  RuntimeFixtureEntry,
  RuntimeFeatureFlags
} from "@devconsole/api-contracts";

// Mock ConfigService for testing
const createMockConfigService = (overrides: Record<string, string> = {}) => ({
  get: (key: string) => overrides[key],
}) as unknown as ConfigService;

test("runtime-config payload matches contract schema", () => {
  const service = new RuntimeConfigService(createMockConfigService({
    RUNTIME_MODE: "local",
    FEATURE_SHARING: "true",
    FEATURE_MULTI_OP: "true",
    FEATURE_TOKEN_DASHBOARD: "true",
    FEATURE_AUDIT_LOG: "true",
    FEATURE_RPC_GATEWAY: "true",
  }));

  const config = service.getConfig();

  // Test version matches constant
  assert.equal(config.version, RUNTIME_CONFIG_VERSION);

  // Test profile is valid
  assert.equal(typeof config.profile, "string");
  assert.ok(["local", "demo", "production"].includes(config.profile));

  // Test networks array structure
  assert.ok(Array.isArray(config.networks));
  config.networks.forEach((network: RuntimeNetworkEntry) => {
    assert.equal(typeof network.id, "string");
    assert.equal(typeof network.name, "string");
    assert.equal(typeof network.rpcUrl, "string");
    assert.equal(typeof network.networkPassphrase, "string");
    // horizonUrl is optional
    if (network.horizonUrl !== undefined) {
      assert.equal(typeof network.horizonUrl, "string");
    }
  });

  // Test fixtures array structure
  assert.ok(Array.isArray(config.fixtures));
  config.fixtures.forEach((fixture: RuntimeFixtureEntry) => {
    assert.equal(typeof fixture.key, "string");
    assert.equal(typeof fixture.label, "string");
    assert.equal(typeof fixture.description, "string");
    assert.equal(typeof fixture.network, "string");
    // contractId can be null or string
    assert.ok(fixture.contractId === null || typeof fixture.contractId === "string");
  });

  // Test feature flags structure
  assert.equal(typeof config.flags, "object");
  const expectedFlags: (keyof RuntimeFeatureFlags)[] = [
    "enableSharing",
    "enableMultiOp", 
    "enableTokenDashboard",
    "enableAuditLog",
    "enableRpcGateway"
  ];
  
  expectedFlags.forEach(flag => {
    assert.equal(typeof config.flags[flag], "boolean", `Flag ${flag} should be boolean`);
  });
});

test("runtime-config handles different profiles correctly", () => {
  const profiles: RuntimeProfile[] = ["local", "demo", "production"];
  
  profiles.forEach(profile => {
    const service = new RuntimeConfigService(createMockConfigService({
      RUNTIME_MODE: profile,
    }));
    
    const config = service.getConfig();
    assert.equal(config.profile, profile);
    
    // Production should have no fixtures
    if (profile === "production") {
      assert.equal(config.fixtures.length, 0);
    } else {
      // Other profiles should have fixtures
      assert.ok(config.fixtures.length > 0);
    }
    
    // Local profile should include local network
    if (profile === "local") {
      const localNetwork = config.networks.find(n => n.id === "local");
      assert.ok(localNetwork, "Local profile should include local network");
    }
  });
});

test("runtime-config validates network entries", () => {
  const service = new RuntimeConfigService(createMockConfigService({
    RUNTIME_MODE: "local",
    SOROBAN_RPC_TESTNET_URL: "https://test.example.com",
  }));

  const config = service.getConfig();
  
  // Should filter out empty RPC URLs
  const networksWithEmptyRpc = config.networks.filter(n => !n.rpcUrl);
  assert.equal(networksWithEmptyRpc.length, 0, "Should filter networks with empty RPC URLs");
  
  // Should have required networks
  const testnetNetwork = config.networks.find(n => n.id === "testnet");
  assert.ok(testnetNetwork, "Should include testnet network");
  assert.equal(testnetNetwork.rpcUrl, "https://test.example.com");
});

test("runtime-config handles feature flag defaults", () => {
  const service = new RuntimeConfigService(createMockConfigService({
    RUNTIME_MODE: "local",
    // No feature flags set - should use defaults
  }));

  const config = service.getConfig();
  
  // Test default values
  assert.equal(config.flags.enableSharing, true);
  assert.equal(config.flags.enableTokenDashboard, true);
  assert.equal(config.flags.enableAuditLog, true);
  assert.equal(config.flags.enableRpcGateway, true);
  
  // multiOp should be true for local (not production)
  assert.equal(config.flags.enableMultiOp, true);
});

test("runtime-config prevents schema drift", () => {
  const service = new RuntimeConfigService(createMockConfigService({
    RUNTIME_MODE: "local",
  }));

  const config = service.getConfig();
  
  // Ensure no extra properties are added
  const configKeys = Object.keys(config).sort();
  const expectedKeys = ["version", "profile", "networks", "fixtures", "flags"].sort();
  assert.deepEqual(configKeys, expectedKeys, "Config should not have extra properties");
  
  // Ensure flags object doesn't have extra properties
  const flagKeys = Object.keys(config.flags).sort();
  const expectedFlagKeys = [
    "enableSharing",
    "enableMultiOp", 
    "enableTokenDashboard",
    "enableAuditLog",
    "enableRpcGateway"
  ].sort();
  assert.deepEqual(flagKeys, expectedFlagKeys, "Flags should not have extra properties");
});
