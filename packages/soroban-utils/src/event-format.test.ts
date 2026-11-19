import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nativeToScVal, xdr } from "@stellar/stellar-sdk";
import {
  diagnosticEventsToJson,
  formatDiagnosticEvent,
  formatDiagnosticEvents,
  toJsonSafe,
  type RawDiagnosticEvent,
} from "./event-format";

const b64 = (v: xdr.ScVal) => v.toXDR("base64");
const sym = (s: string) => b64(nativeToScVal(s, { type: "symbol" }));

const event = (id: string, ledger: number, extra: Partial<RawDiagnosticEvent> = {}): RawDiagnosticEvent => ({
  id,
  contractId: "CABC",
  ledger,
  topics: [sym("transfer")],
  data: b64(nativeToScVal(2n ** 70n, { type: "i128" })),
  ...extra,
});

describe("diagnostic event canonical formatter (#1394)", () => {
  it("preserves raw XDR and adds decoded fields", () => {
    const e = event("0001-1", 5);
    const out = formatDiagnosticEvent(e);
    assert.equal(out.topics[0].raw, e.topics[0]);
    assert.equal(out.topics[0].decoded, "transfer");
    assert.equal(out.data.raw, e.data);
    assert.equal(out.data.decoded, (2n ** 70n).toString());
  });

  it("keeps raw XDR and reports the error when decoding fails", () => {
    const out = formatDiagnosticEvent(event("1", 1, { topics: ["not-xdr"], data: "AAAA" }));
    assert.equal(out.topics[0].raw, "not-xdr");
    assert.equal(out.topics[0].decoded, undefined);
    assert.ok(out.topics[0].decodeError);
    assert.equal(out.data.raw, "AAAA");
  });

  it("does not let missing invocation context change event order", () => {
    const withContext = [
      event("b", 2, { invocation: { txHash: "T2", function: "f", callIndex: 0 } }),
      event("a", 2, { invocation: { txHash: "T1" } }),
      event("c", 1),
    ];
    const without = withContext.map(({ invocation: _ignored, ...rest }) => rest as RawDiagnosticEvent);
    const orderWith = formatDiagnosticEvents(withContext).map((e) => e.id);
    const orderWithout = formatDiagnosticEvents(without).map((e) => e.id);
    assert.deepEqual(orderWith, ["c", "a", "b"]);
    assert.deepEqual(orderWithout, orderWith);
  });

  it("omits invocation when none was supplied or all fields are empty", () => {
    assert.equal("invocation" in formatDiagnosticEvent(event("1", 1)), false);
    assert.equal("invocation" in formatDiagnosticEvent(event("1", 1, { invocation: {} })), false);
    assert.deepEqual(formatDiagnosticEvent(event("1", 1, { invocation: { txHash: "T" } })).invocation, { txHash: "T" });
  });

  it("is stable for equal inputs and export-safe (bigint, bytes, maps)", () => {
    const events = [event("2", 2), event("1", 1)];
    assert.equal(diagnosticEventsToJson(events), diagnosticEventsToJson([...events].reverse()));
    const json = toJsonSafe({ z: 1n, a: new Uint8Array([1, 255]), m: new Map([["k", 2n]]) });
    assert.equal(JSON.stringify(json), '{"a":{"bytes":"01ff"},"m":{"map":[["k","2"]]},"z":"1"}');
  });

  it("keeps input order for events with the same ledger and id", () => {
    const a = event("x", 1, { contractId: "CA" });
    const b = event("x", 1, { contractId: "CB" });
    assert.deepEqual(formatDiagnosticEvents([a, b]).map((e) => e.contractId), ["CA", "CB"]);
  });
});
