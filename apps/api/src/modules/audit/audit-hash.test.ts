import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  auditStreamKey,
  canonicalAuditPayload,
  canonicalJson,
  computeAuditHash,
  verifyAuditChain,
  type ChainedAuditEvent,
} from "./audit-hash.js";

function chain(count: number): ChainedAuditEvent[] {
  const events: ChainedAuditEvent[] = [];
  let prev: string | null = null;
  for (let i = 0; i < count; i += 1) {
    const base = {
      id: `e${i}`,
      actor: "alice",
      action: "workspace.update",
      resourceType: "workspace",
      resourceId: "w1",
      metadata: { n: i, z: 1, a: [1, 2] },
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
    };
    const hash = computeAuditHash(base, prev);
    events.push({ ...base, hash, prevHash: prev });
    prev = hash;
  }
  return events;
}

describe("audit hash chaining (#1377)", () => {
  it("builds the stream key from resource type and id", () => {
    assert.equal(auditStreamKey("workspace", "w1"), "workspace:w1");
  });

  it("serializes canonically: key order and undefined do not matter", () => {
    assert.equal(canonicalJson({ b: 1, a: { d: 2, c: undefined } }), canonicalJson({ a: { d: 2 }, b: 1 }));
    assert.equal(canonicalJson({ a: [{ y: 1, x: 2 }] }), '{"a":[{"x":2,"y":1}]}');
  });

  it("excludes mutable presentation fields from the hash", () => {
    const [event] = chain(1);
    const withSummary = { ...event, summary: "Display text changed" } as typeof event;
    assert.equal(canonicalAuditPayload(withSummary, null), canonicalAuditPayload(event, null));
    assert.ok(!canonicalAuditPayload(event, null).includes("summary"));
  });

  it("accepts an intact chain", () => {
    assert.deepEqual(verifyAuditChain(chain(5)), { ok: true, checked: 5, unchained: 0 });
    assert.deepEqual(verifyAuditChain([]), { ok: true, checked: 0, unchained: 0 });
  });

  it("reports the first broken link and the affected range for an edited row", () => {
    const events = chain(5);
    events[2] = { ...events[2], actor: "mallory" };
    const result = verifyAuditChain(events);
    assert.equal(result.ok, false);
    assert.equal(result.firstBroken?.index, 2);
    assert.equal(result.firstBroken?.id, "e2");
    assert.equal(result.firstBroken?.reason, "HASH_MISMATCH");
    assert.deepEqual(result.affectedRange, { fromId: "e2", toId: "e4", count: 3 });
    assert.equal(result.checked, 2);
  });

  it("detects a deleted row as a broken prev-hash link", () => {
    const events = chain(5);
    events.splice(2, 1);
    const result = verifyAuditChain(events);
    assert.equal(result.firstBroken?.id, "e3");
    assert.equal(result.firstBroken?.reason, "PREV_HASH_MISMATCH");
  });

  it("detects reordered and tampered-metadata rows", () => {
    const events = chain(4);
    [events[1], events[2]] = [events[2], events[1]];
    assert.equal(verifyAuditChain(events).ok, false);
    const tampered = chain(3);
    tampered[1] = { ...tampered[1], metadata: { n: 1, z: 999, a: [1, 2] } };
    assert.equal(verifyAuditChain(tampered).firstBroken?.id, "e1");
  });

  it("skips legacy unchained rows and requires the first chained row to start the chain", () => {
    const events = chain(3);
    const legacy = { ...events[0], id: "old", hash: null, prevHash: null };
    assert.deepEqual(verifyAuditChain([legacy, ...events]), { ok: true, checked: 3, unchained: 1 });
    assert.equal(verifyAuditChain([legacy, events[1], events[2]]).ok, false);
  });
});
