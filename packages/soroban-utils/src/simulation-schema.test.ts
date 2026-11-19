import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { NormalizedSimulationResult } from "./simulation";
import {
  SIMULATION_SCHEMA_VERSION,
  SimulationSchemaError,
  parseSimulationResult,
  serializeSimulationResult,
} from "./simulation-schema";

const current: NormalizedSimulationResult = {
  ok: true,
  minResourceFee: "1234",
  resultXdr: "AAAA",
  auth: [{ address: "GABC", kind: "account" }],
  requiredAuthKeys: ["GABC"],
  stateChangesCount: 0,
  stateChanges: [],
};

describe("simulation result schema versioning (#1395)", () => {
  it("serialized results include the schema version and round-trip", () => {
    const serialized = serializeSimulationResult(current);
    assert.equal(serialized.schemaVersion, SIMULATION_SCHEMA_VERSION);
    assert.deepEqual(parseSimulationResult(JSON.parse(JSON.stringify(serialized))), current);
  });

  it("migrates v1 and unversioned legacy results to the current model", () => {
    const legacy = { ok: true, fee: 500, auth: ["GACCOUNT", "CCONTRACT", "other"], stateChanges: [{ type: "created" }], resultXdr: "AAAA" };
    const expected: NormalizedSimulationResult = {
      ok: true,
      minResourceFee: "500",
      resultXdr: "AAAA",
      auth: [
        { address: "GACCOUNT", kind: "account" },
        { address: "CCONTRACT", kind: "contract" },
        { address: "other", kind: "unknown" },
      ],
      requiredAuthKeys: ["GACCOUNT", "CCONTRACT", "other"],
      stateChangesCount: 1,
      stateChanges: [{ type: "created" }] as never,
    };
    assert.deepEqual(parseSimulationResult(legacy), expected);
    assert.deepEqual(parseSimulationResult({ schemaVersion: 1, ...legacy }), expected);
  });

  it("migrates a failed legacy result keeping its error", () => {
    const out = parseSimulationResult({ ok: false, error: "HostError" });
    assert.equal(out.ok, false);
    assert.equal(out.error, "HostError");
    assert.deepEqual(out.auth, []);
    assert.equal(out.minResourceFee, undefined);
  });

  it("fails clearly on a future version", () => {
    assert.throws(
      () => parseSimulationResult({ schemaVersion: SIMULATION_SCHEMA_VERSION + 1, result: current }),
      (e: unknown) => {
        assert.ok(e instanceof SimulationSchemaError);
        assert.equal(e.code, "UNSUPPORTED_FUTURE_VERSION");
        assert.match(e.message, /newer than this build supports/);
        return true;
      },
    );
  });

  it("rejects malformed input with INVALID_RESULT", () => {
    for (const bad of [null, "x", [], { schemaVersion: "2" }, { schemaVersion: 0 }, { schemaVersion: 2 }, { schemaVersion: 2, result: { ok: "yes" } }]) {
      assert.throws(() => parseSimulationResult(bad), (e: unknown) => e instanceof SimulationSchemaError && e.code === "INVALID_RESULT");
    }
  });
});
