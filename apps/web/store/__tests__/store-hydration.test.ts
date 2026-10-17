import { beforeEach, describe, expect, it } from "vitest";
import { useContractStore } from "../useContractStore";
import { useDeploymentLogStore } from "../useDeploymentLogStore";
import { useResultBundlesStore } from "../useResultBundlesStore";
import { useSavedCallsStore } from "../useSavedCallsStore";
import { useTrackedTokensStore } from "../useTrackedTokensStore";
import { useWorkspaceNotesStore } from "../useWorkspaceNotesStore";
import { safeMerge } from "../safe-merge";

type PersistedStore = {
  getState: () => Record<string, unknown>;
  setState: (partial: Record<string, unknown>) => void;
  persist: { rehydrate: () => Promise<void> | void; getOptions: () => { name?: string } };
};

/** Stores whose persisted state includes an array/collection that consumers iterate. */
const stores: { label: string; store: PersistedStore; arrayKey: string }[] = [
  { label: "contracts", store: useContractStore as unknown as PersistedStore, arrayKey: "contracts" },
  { label: "deployment log", store: useDeploymentLogStore as unknown as PersistedStore, arrayKey: "entries" },
  { label: "saved calls", store: useSavedCallsStore as unknown as PersistedStore, arrayKey: "savedCalls" },
  { label: "tracked tokens", store: useTrackedTokensStore as unknown as PersistedStore, arrayKey: "tokens" },
  { label: "result bundles", store: useResultBundlesStore as unknown as PersistedStore, arrayKey: "bundles" },
];

const corruptions: Record<string, (arrayKey: string) => string> = {
  "invalid JSON": () => "{not json",
  "truncated JSON": () => '{"state":{"x":[1,2',
  "JSON null": () => "null",
  "JSON string": () => '"hello"',
  "JSON array": () => "[1,2,3]",
  "empty object": () => "{}",
  "null state": () => '{"state":null,"version":0}',
  "array replaced by string": (k) => `{"state":{"${k}":"oops"},"version":0}`,
  "array replaced by object": (k) => `{"state":{"${k}":{"a":1}},"version":0}`,
  "array replaced by number": (k) => `{"state":{"${k}":42},"version":0}`,
  "array replaced by null": (k) => `{"state":{"${k}":null},"version":0}`,
};

describe("persisted store hydration with corrupted localStorage (#1304)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  for (const { label, store, arrayKey } of stores) {
    describe(label, () => {
      for (const [name, build] of Object.entries(corruptions)) {
        it(`survives: ${name}`, async () => {
          const key = store.persist.getOptions().name!;
          const before = store.getState();
          expect(Array.isArray(before[arrayKey])).toBe(true);

          localStorage.setItem(key, build(arrayKey));
          await expect(Promise.resolve(store.persist.rehydrate())).resolves.not.toThrow();

          const after = store.getState();
          expect(Array.isArray(after[arrayKey])).toBe(true);
          // Actions are never clobbered by persisted data.
          for (const [k, v] of Object.entries(before)) {
            if (typeof v === "function") expect(typeof after[k]).toBe("function");
          }
        });
      }

      it("still restores valid persisted data", async () => {
        const key = store.persist.getOptions().name!;
        const saved = store.getState()[arrayKey] as unknown[];
        store.setState({ [arrayKey]: [{ id: "keep-me" }] });
        const raw = localStorage.getItem(key);
        expect(raw).toContain("keep-me");
        store.setState({ [arrayKey]: saved });
        localStorage.setItem(key, raw!);
        await store.persist.rehydrate();
        expect((store.getState()[arrayKey] as { id: string }[])[0]?.id).toBe("keep-me");
      });
    });
  }

  it("workspace notes keep their map shape when the persisted value is wrong", async () => {
    const store = useWorkspaceNotesStore as unknown as PersistedStore;
    const key = store.persist.getOptions().name!;
    const shape = Object.keys(store.getState()).filter((k) => typeof store.getState()[k] !== "function");
    expect(shape.length).toBeGreaterThan(0);
    const [first] = shape;
    const before = typeof store.getState()[first];
    localStorage.setItem(key, `{"state":{"${first}":"oops"},"version":0}`);
    await store.persist.rehydrate();
    expect(typeof store.getState()[first]).toBe(before);
  });
});

describe("safeMerge", () => {
  const current = { items: [] as string[], count: 0, flag: false, nested: { a: 1 }, maybe: null as string | null, act: () => 1 };

  it("returns current state for non-object input", () => {
    for (const bad of [null, undefined, "x", 3, [1]]) expect(safeMerge(bad, current)).toBe(current);
  });

  it("accepts values of the same kind", () => {
    const merged = safeMerge({ items: ["a"], count: 5, flag: true, nested: { a: 2 } }, current);
    expect(merged).toMatchObject({ items: ["a"], count: 5, flag: true, nested: { a: 2 } });
  });

  it("rejects values of a different kind", () => {
    const merged = safeMerge({ items: "oops", count: "5", flag: 1, nested: [] }, current);
    expect(merged).toMatchObject({ items: [], count: 0, flag: false, nested: { a: 1 } });
  });

  it("accepts anything for null defaults, ignores unknown keys, never overwrites actions", () => {
    const merged = safeMerge({ maybe: "set", unknown: 1, act: "evil" }, current) as Record<string, unknown>;
    expect(merged.maybe).toBe("set");
    expect("unknown" in merged).toBe(false);
    expect(typeof merged.act).toBe("function");
  });
});
