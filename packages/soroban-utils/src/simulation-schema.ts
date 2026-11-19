import type { NormalizedSimulationResult } from "./simulation";

/**
 * Versioned serialization of simulation results.
 *
 *  - v1 (and unversioned legacy data): `{ ok, error?, fee?, auth?: string[], stateChanges? }`
 *  - v2 (current): `{ schemaVersion: 2, result: NormalizedSimulationResult }`
 *
 * Supported older versions are migrated step by step to the current model;
 * a version newer than this code understands fails with a compatibility error
 * rather than being guessed at.
 */
export const SIMULATION_SCHEMA_VERSION = 2;

export interface SerializedSimulationResult {
  schemaVersion: typeof SIMULATION_SCHEMA_VERSION;
  result: NormalizedSimulationResult;
}

export type SimulationSchemaErrorCode = "INVALID_RESULT" | "UNSUPPORTED_FUTURE_VERSION" | "UNSUPPORTED_VERSION";

export class SimulationSchemaError extends Error {
  constructor(readonly code: SimulationSchemaErrorCode, message: string, readonly version?: unknown) {
    super(message);
    this.name = "SimulationSchemaError";
  }
}

/** Wrap a normalized result with the current schema version. */
export function serializeSimulationResult(result: NormalizedSimulationResult): SerializedSimulationResult {
  return { schemaVersion: SIMULATION_SCHEMA_VERSION, result };
}

type Record_ = Record<string, unknown>;
const isRecord = (v: unknown): v is Record_ => typeof v === "object" && v !== null && !Array.isArray(v);

/** v1 -> v2: `fee` became `minResourceFee`; `auth` strings became typed entries. */
function migrateV1(data: Record_): Record_ {
  const auth = Array.isArray(data.auth) ? data.auth : [];
  const entries = auth.filter((a): a is string => typeof a === "string");
  const stateChanges = Array.isArray(data.stateChanges) ? data.stateChanges : [];
  const migrated: Record_ = {
    ok: data.ok,
    auth: entries.map((address) => ({
      address,
      kind: address.startsWith("G") ? "account" : address.startsWith("C") ? "contract" : "unknown",
    })),
    requiredAuthKeys: entries,
    stateChangesCount: stateChanges.length,
    stateChanges,
  };
  if (typeof data.error === "string") migrated.error = data.error;
  if (data.fee !== undefined && data.fee !== null) migrated.minResourceFee = String(data.fee);
  if (typeof data.resultXdr === "string") migrated.resultXdr = data.resultXdr;
  return migrated;
}

function assertCurrentShape(result: Record_): asserts result is Record_ & NormalizedSimulationResult {
  if (typeof result.ok !== "boolean") throw new SimulationSchemaError("INVALID_RESULT", "result.ok must be a boolean");
  if (!Array.isArray(result.auth)) throw new SimulationSchemaError("INVALID_RESULT", "result.auth must be an array");
  if (!Array.isArray(result.requiredAuthKeys)) {
    throw new SimulationSchemaError("INVALID_RESULT", "result.requiredAuthKeys must be an array");
  }
  if (typeof result.stateChangesCount !== "number" || !Array.isArray(result.stateChanges)) {
    throw new SimulationSchemaError("INVALID_RESULT", "result.stateChanges is malformed");
  }
}

/**
 * Parse stored simulation JSON (an object, not text) into the current model,
 * migrating from any supported older version.
 */
export function parseSimulationResult(input: unknown): NormalizedSimulationResult {
  if (!isRecord(input)) throw new SimulationSchemaError("INVALID_RESULT", "serialized simulation result must be an object");

  const version = input.schemaVersion;
  if (version === undefined || version === 1) {
    // Legacy data was stored without a version field.
    const migrated = migrateV1(input);
    assertCurrentShape(migrated);
    return migrated;
  }
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new SimulationSchemaError("INVALID_RESULT", "schemaVersion must be a positive integer", version);
  }
  if (version > SIMULATION_SCHEMA_VERSION) {
    throw new SimulationSchemaError(
      "UNSUPPORTED_FUTURE_VERSION",
      `Simulation result schema v${version} is newer than this build supports (v${SIMULATION_SCHEMA_VERSION}). Update the app to read it.`,
      version,
    );
  }
  if (version !== SIMULATION_SCHEMA_VERSION) {
    throw new SimulationSchemaError("UNSUPPORTED_VERSION", `No migration from schema v${version}`, version);
  }
  if (!isRecord(input.result)) throw new SimulationSchemaError("INVALID_RESULT", "result must be an object");
  assertCurrentShape(input.result);
  return input.result;
}
