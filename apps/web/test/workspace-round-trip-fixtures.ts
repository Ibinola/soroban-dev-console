/**
 * DEVOPS-023: Regression fixtures for workspace export/import round-trip auditing.
 * Curated payloads covering healthy, repaired, legacy, and dependency-heavy workspaces.
 */

export interface WorkspaceFixture {
  label: string;
  kind: "healthy" | "repaired" | "legacy" | "dependency-heavy";
  payload: Record<string, unknown>;
}

export const HEALTHY_FIXTURE: WorkspaceFixture = {
  label: "healthy-workspace",
  kind: "healthy",
  payload: {
    id: "ws-healthy-001",
    name: "Healthy Workspace",
    schemaVersion: 3,
    selectedNetwork: "testnet",
    savedContracts: [{ contractId: "CABC123", network: "testnet" }],
    savedInteractions: [{ functionName: "increment", argumentsJson: { value: 1 } }],
    artifacts: [{ kind: "wasm", name: "counter", network: "testnet", hash: "abc123", metadata: null }],
  },
};

export const REPAIRED_FIXTURE: WorkspaceFixture = {
  label: "repaired-workspace",
  kind: "repaired",
  payload: {
    id: "ws-repaired-001",
    name: "Repaired Workspace",
    schemaVersion: 3,
    selectedNetwork: "testnet",
    savedContracts: [],
    savedInteractions: [],
    artifacts: [],
    _repaired: true,
    _repairedFields: ["savedContracts", "savedInteractions"],
  },
};

export const LEGACY_FIXTURE: WorkspaceFixture = {
  label: "legacy-workspace",
  kind: "legacy",
  payload: {
    id: "ws-legacy-001",
    name: "Legacy Workspace",
    schemaVersion: 1,
    network: "testnet",
    contracts: [{ id: "CXYZ789", net: "testnet" }],
  },
};

export const DEPENDENCY_HEAVY_FIXTURE: WorkspaceFixture = {
  label: "dependency-heavy-workspace",
  kind: "dependency-heavy",
  payload: {
    id: "ws-deps-001",
    name: "Dependency Heavy Workspace",
    schemaVersion: 3,
    selectedNetwork: "testnet",
    savedContracts: Array.from({ length: 10 }, (_, i) => ({ contractId: `CDEP${i}`, network: "testnet" })),
    savedInteractions: Array.from({ length: 10 }, (_, i) => ({ functionName: `fn_${i}`, argumentsJson: { i } })),
    artifacts: Array.from({ length: 5 }, (_, i) => ({ kind: "wasm", name: `contract_${i}`, network: "testnet", hash: `hash${i}`, metadata: null })),
  },
};

export const ALL_FIXTURES: WorkspaceFixture[] = [
  HEALTHY_FIXTURE,
  REPAIRED_FIXTURE,
  LEGACY_FIXTURE,
  DEPENDENCY_HEAVY_FIXTURE,
];
