import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RESOURCE_LIMIT_PROFILE_ID,
  getResourceLimitProfile,
  listResourceLimitProfileIds,
  listResourceLimitProfiles,
  withLimitOverrides,
} from "./resource-limits";

describe("resource limit policy table (#1393)", () => {
  it("profiles identify their protocol version and effective limits", () => {
    const lookup = getResourceLimitProfile("soroban-p22");
    assert.ok(lookup.supported);
    assert.equal(lookup.profile.protocolVersion, 22);
    assert.equal(lookup.profile.limits.cpuInstructions, 100_000_000);
    assert.equal(lookup.profile.limits.readEntries, 40);
  });

  it("returns an explicit unsupported result for unknown profiles", () => {
    const lookup = getResourceLimitProfile("soroban-p99");
    assert.deepEqual(lookup, { supported: false, requested: "soroban-p99", available: ["soroban-p21", "soroban-p22"] });
    assert.equal(getResourceLimitProfile("__proto__").supported, false);
    assert.equal(getResourceLimitProfile("toString").supported, false);
  });

  it("selects the default profile when no id is given", () => {
    const lookup = getResourceLimitProfile();
    assert.ok(lookup.supported);
    assert.equal(lookup.profile.id, DEFAULT_RESOURCE_LIMIT_PROFILE_ID);
  });

  it("does not let callers mutate the shared table", () => {
    const first = getResourceLimitProfile("soroban-p21");
    assert.ok(first.supported);
    first.profile.limits.cpuInstructions = 1;
    first.profile.name = "changed";
    const second = getResourceLimitProfile("soroban-p21");
    assert.ok(second.supported);
    assert.equal(second.profile.limits.cpuInstructions, 100_000_000);
    assert.notEqual(second.profile.name, "changed");
    for (const copy of listResourceLimitProfiles()) copy.limits.readEntries = 0;
    assert.equal(listResourceLimitProfiles()[0].limits.readEntries, 40);
  });

  it("overrides produce a new profile and validate their input", () => {
    const base = getResourceLimitProfile("soroban-p22");
    assert.ok(base.supported);
    const custom = withLimitOverrides(base.profile, { readEntries: 10 });
    assert.equal(custom.limits.readEntries, 10);
    assert.equal(custom.id, "soroban-p22+custom");
    assert.equal(base.profile.limits.readEntries, 40);
    assert.throws(() => withLimitOverrides(base.profile, { readEntries: -1 }));
    assert.throws(() => withLimitOverrides(base.profile, { nope: 1 } as never));
  });

  it("lists ids in sorted order", () => {
    assert.deepEqual(listResourceLimitProfileIds(), ["soroban-p21", "soroban-p22"]);
  });
});
