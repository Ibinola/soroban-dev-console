/**
 * FE-015: Fixture contract manifest.
 *
 * Contract IDs are read from environment variables written by
 * scripts/deploy-test-suite.sh (NEXT_PUBLIC_CONTRACT_*).
 * Switching fixture versions or networks only requires re-running
 * the deploy script — no UI files need editing.
 */

export interface FixtureContract {
  key: string;
  label: string;
  description: string;
  network: "testnet" | "local";
  contractId: string | null;
}

const env = (key: string): string | null =>
  process.env[key] ?? null;

export const FIXTURE_CONTRACTS: FixtureContract[] = [
  {
    key: "counter",
    label: "Counter",
    description: "Simple increment/decrement counter for testing basic calls.",
    network: "local",
    contractId: env("NEXT_PUBLIC_CONTRACT_COUNTER_FIXTURE"),
  },
  {
    key: "token",
    label: "Token",
    description: "SAC-compatible token fixture for transfer/mint demos.",
    network: "local",
    contractId: env("NEXT_PUBLIC_CONTRACT_TOKEN_FIXTURE"),
  },
  {
    key: "event",
    label: "Event Emitter",
    description: "Emits contract events for testing the event feed.",
    network: "local",
    contractId: env("NEXT_PUBLIC_CONTRACT_EVENT_FIXTURE"),
  },
  {
    key: "failure",
    label: "Failure Fixture",
    description: "Intentionally fails to test error handling flows.",
    network: "local",
    contractId: env("NEXT_PUBLIC_CONTRACT_FAILURE_FIXTURE"),
  },
  {
    key: "types-tester",
    label: "Types Tester",
    description: "Exercises all Soroban ScVal types for ABI form testing.",
    network: "local",
    contractId: env("NEXT_PUBLIC_CONTRACT_TYPES_TESTER"),
  },
  {
    key: "auth-tester",
    label: "Auth Tester",
    description: "Tests authorization flows and account-based access control.",
    network: "local",
    contractId: env("NEXT_PUBLIC_CONTRACT_AUTH_TESTER"),
  },
  {
    key: "source-registry",
    label: "Source Registry",
    description: "Registry contract for source verification demos.",
    network: "local",
    contractId: env("NEXT_PUBLIC_CONTRACT_SOURCE_REGISTRY"),
  },
  {
    key: "error-trigger",
    label: "Error Trigger",
    description: "Triggers specific error codes for debugging UI.",
    network: "local",
    contractId: env("NEXT_PUBLIC_CONTRACT_ERROR_TRIGGER"),
  },
];

/** Returns only fixture contracts that have a deployed contract ID. */
export function getDeployedFixtures(): FixtureContract[] {
  return FIXTURE_CONTRACTS.filter((f) => f.contractId !== null);
}
