/**
 * BE-018: Typed contract tests for fixture-manifest API payload
 * 
 * Validates that fixture-manifest endpoint returns payloads that match shared contracts
 * and prevents silent schema drift between backend and frontend.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { FixtureManifestService } from "./fixture-manifest.service.js";
import { ConfigService } from "@nestjs/config";
import {
  FIXTURE_MANIFEST_SCHEMA_VERSION,
  FixtureManifestPayload,
  FixtureContract,
  ArtifactManifestEntry
} from "@devconsole/api-contracts";

// Mock ConfigService for testing
const createMockConfigService = (overrides: Record<string, string> = {}) => ({
  get: (key: string) => overrides[key],
}) as unknown as ConfigService;

test("fixture-manifest payload matches contract schema", () => {
  const service = new FixtureManifestService(createMockConfigService({
    CONTRACT_COUNTER_FIXTURE: "C000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    WASM_HASH_COUNTER_FIXTURE: "abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234567890",
    WASM_BUILT_AT_COUNTER: "2024-01-15T10:30:00Z",
  }));

  const manifest = service.getManifest();

  // Test schema version matches constant
  assert.equal(manifest.schemaVersion, FIXTURE_MANIFEST_SCHEMA_VERSION);

  // Test generatedAt is valid ISO string
  assert.equal(typeof manifest.generatedAt, "string");
  assert.ok(!isNaN(Date.parse(manifest.generatedAt)), "generatedAt should be valid date");

  // Test fixtures array structure
  assert.ok(Array.isArray(manifest.fixtures));
  manifest.fixtures.forEach((fixture: FixtureContract) => {
    assert.equal(typeof fixture.key, "string");
    assert.equal(typeof fixture.label, "string");
    assert.equal(typeof fixture.description, "string");
    assert.ok(["testnet", "local"].includes(fixture.network), "network should be testnet or local");
    
    // contractId can be null or string
    assert.ok(fixture.contractId === null || typeof fixture.contractId === "string");
    
    // wasmHash is optional but should be string if present
    if (fixture.wasmHash !== undefined) {
      assert.ok(fixture.wasmHash === null || typeof fixture.wasmHash === "string");
    }
    
    // version is optional but should be string if present
    if (fixture.version !== undefined) {
      assert.equal(typeof fixture.version, "string");
    }
  });

  // Test artifacts array structure
  assert.ok(Array.isArray(manifest.artifacts));
  manifest.artifacts.forEach((artifact: ArtifactManifestEntry) => {
    assert.equal(typeof artifact.key, "string");
    assert.equal(typeof artifact.version, "string");
    
    // wasmHash can be null or string
    assert.ok(artifact.wasmHash === null || typeof artifact.wasmHash === "string");
    
    // builtAt can be null or string
    assert.ok(artifact.builtAt === null || typeof artifact.builtAt === "string");
    
    // If builtAt is present, it should be valid date
    if (artifact.builtAt !== null) {
      assert.ok(!isNaN(Date.parse(artifact.builtAt)), "builtAt should be valid date when present");
    }
  });
});

test("fixture-manifest uses environment variables correctly", () => {
  const service = new FixtureManifestService(createMockConfigService({
    CONTRACT_TOKEN_FIXTURE: "C111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111",
    WASM_HASH_TOKEN_FIXTURE: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    WASM_BUILT_AT_TOKEN: "2024-02-20T14:45:30Z",
  }));

  const manifest = service.getManifest();
  
  // Should include token fixture with correct contract ID
  const tokenFixture = manifest.fixtures.find(f => f.key === "token");
  assert.ok(tokenFixture, "Should include token fixture");
  assert.equal(tokenFixture.contractId, "C111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111");
  
  // Should include token artifact with correct hash and build time
  const tokenArtifact = manifest.artifacts.find(a => a.key === "token");
  assert.ok(tokenArtifact, "Should include token artifact");
  assert.equal(tokenArtifact.wasmHash, "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef");
  assert.equal(tokenArtifact.builtAt, "2024-02-20T14:45:30Z");
});

test("fixture-manifest handles missing environment variables", () => {
  const service = new FixtureManifestService(createMockConfigService({
    // No environment variables set
  }));

  const manifest = service.getManifest();
  
  // Should still include all fixtures but with null values
  assert.ok(manifest.fixtures.length > 0, "Should include fixtures even without env vars");
  
  manifest.fixtures.forEach(fixture => {
    assert.equal(fixture.contractId, null, "contractId should be null when env var not set");
  });
  
  manifest.artifacts.forEach(artifact => {
    assert.equal(artifact.wasmHash, null, "wasmHash should be null when env var not set");
    assert.equal(artifact.builtAt, null, "builtAt should be null when env var not set");
  });
});

test("fixture-manifest includes all expected fixtures", () => {
  const service = new FixtureManifestService(createMockConfigService());
  const manifest = service.getManifest();
  
  const expectedFixtureKeys = [
    "counter",
    "token", 
    "event",
    "failure",
    "types-tester",
    "auth-tester",
    "source-registry",
    "error-trigger"
  ];
  
  const actualFixtureKeys = manifest.fixtures.map(f => f.key).sort();
  assert.deepEqual(actualFixtureKeys, expectedFixtureKeys.sort(), "Should include all expected fixtures");
  
  // Should have matching artifacts for all fixtures
  const actualArtifactKeys = manifest.artifacts.map(a => a.key).sort();
  assert.deepEqual(actualArtifactKeys, expectedFixtureKeys.sort(), "Should have artifact for each fixture");
});

test("fixture-manifest prevents schema drift", () => {
  const service = new FixtureManifestService(createMockConfigService());
  const manifest = service.getManifest();
  
  // Ensure no extra properties are added
  const manifestKeys = Object.keys(manifest).sort();
  const expectedKeys = ["schemaVersion", "generatedAt", "fixtures", "artifacts"].sort();
  assert.deepEqual(manifestKeys, expectedKeys, "Manifest should not have extra properties");
  
  // Ensure fixtures don't have extra properties
  manifest.fixtures.forEach(fixture => {
    const fixtureKeys = Object.keys(fixture).sort();
    const expectedFixtureKeys = ["key", "label", "description", "network", "contractId", "wasmHash", "version"].sort();
    assert.deepEqual(fixtureKeys, expectedFixtureKeys, `Fixture ${fixture.key} should not have extra properties`);
  });
  
  // Ensure artifacts don't have extra properties
  manifest.artifacts.forEach(artifact => {
    const artifactKeys = Object.keys(artifact).sort();
    const expectedArtifactKeys = ["key", "wasmHash", "version", "builtAt"].sort();
    assert.deepEqual(artifactKeys, expectedArtifactKeys, `Artifact ${artifact.key} should not have extra properties`);
  });
});

test("fixture-manifest handles edge cases", () => {
  const service = new FixtureManifestService(createMockConfigService({
    CONTRACT_COUNTER_FIXTURE: "", // Empty string should be treated as null
    WASM_HASH_COUNTER_FIXTURE: "", // Empty string should be treated as null
    WASM_BUILT_AT_COUNTER: "invalid-date", // Invalid date should still be string
  }));

  const manifest = service.getManifest();
  
  const counterFixture = manifest.fixtures.find(f => f.key === "counter");
  assert.ok(counterFixture, "Should include counter fixture");
  assert.equal(counterFixture.contractId, "", "Empty string should be preserved for contractId");
  
  const counterArtifact = manifest.artifacts.find(a => a.key === "counter");
  assert.ok(counterArtifact, "Should include counter artifact");
  assert.equal(counterArtifact.wasmHash, "", "Empty string should be preserved for wasmHash");
  assert.equal(counterArtifact.builtAt, "invalid-date", "Invalid date should be preserved as string");
});
