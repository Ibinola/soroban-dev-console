import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ScheduleGate, type ScheduleLogEvent } from "./schedule-gate.js";

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

describe("idempotent scheduled runs (#1382)", () => {
  it("lets at most one of several concurrent triggers run", async () => {
    const events: ScheduleLogEvent[] = [];
    const gate = new ScheduleGate((e) => events.push(e));
    const gateOpen = deferred();
    let runs = 0;
    const task = async () => {
      runs += 1;
      await gateOpen.promise;
      return "done";
    };

    const results = [gate.runOnce("backup:a", task), gate.runOnce("backup:a", task), gate.runOnce("backup:a", task)];
    gateOpen.resolve();
    const settled = await Promise.all(results);

    assert.equal(runs, 1);
    assert.deepEqual(settled.map((r) => r.status).sort(), ["ran", "skipped", "skipped"]);
    assert.deepEqual(events.map((e) => e.outcome), ["started", "skipped_active", "skipped_active", "completed"]);
    assert.ok(events.every((e) => e.dedupeKey === "backup:a"));
  });

  it("permits the next scheduled run once the previous one completed", async () => {
    const gate = new ScheduleGate();
    let runs = 0;
    const task = async () => ++runs;
    assert.deepEqual(await gate.runOnce("k", task), { status: "ran", value: 1 });
    assert.equal(gate.isActive("k"), false);
    assert.deepEqual(await gate.runOnce("k", task), { status: "ran", value: 2 });
  });

  it("releases the key after a failure, logs it, and rethrows", async () => {
    const events: ScheduleLogEvent[] = [];
    const gate = new ScheduleGate((e) => events.push(e));
    await assert.rejects(() => gate.runOnce("k", async () => { throw new Error("disk full"); }), /disk full/);
    assert.equal(gate.isActive("k"), false);
    const failed = events.find((e) => e.outcome === "failed");
    assert.equal(failed?.error, "disk full");
    assert.equal((await gate.runOnce("k", async () => "ok")).status, "ran");
  });

  it("does not block different schedule keys and logs durations", async () => {
    let t = 1000;
    const events: ScheduleLogEvent[] = [];
    const gate = new ScheduleGate((e) => events.push(e), () => t);
    const hold = deferred();
    const a = gate.runOnce("a", async () => hold.promise);
    const b = await gate.runOnce("b", async () => (t += 50, "b"));
    assert.equal(b.status, "ran");
    t += 25;
    hold.resolve();
    await a;
    assert.equal(events.find((e) => e.dedupeKey === "b" && e.outcome === "completed")?.durationMs, 50);
    assert.equal(events.find((e) => e.dedupeKey === "a" && e.outcome === "completed")?.durationMs, 75);
  });
});
