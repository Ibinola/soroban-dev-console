import { describe, it, expect, beforeEach } from "vitest";
import {
  CUSTOM_XDR_PRESETS_KEY,
  MAX_CUSTOM_PRESETS,
  MAX_PRESET_LABEL_LENGTH,
  addCustomPreset,
  createPresetId,
  loadCustomPresets,
  parseCustomPresets,
  removeCustomPreset,
  serializeCustomPresets,
  type CustomXdrPreset,
  type StorageLike,
} from "./xdr-custom-presets";

class FakeStorage implements StorageLike {
  private map = new Map<string, string>();
  public throwOnSet = false;

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSet) throw new DOMException("QuotaExceededError");
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  seed(raw: string): void {
    this.map.set(CUSTOM_XDR_PRESETS_KEY, raw);
  }
}

let storage: FakeStorage;

beforeEach(() => {
  storage = new FakeStorage();
});

describe("parseCustomPresets", () => {
  it("returns an empty list for missing or malformed payloads", () => {
    expect(parseCustomPresets(null)).toEqual([]);
    expect(parseCustomPresets("")).toEqual([]);
    expect(parseCustomPresets("{not json")).toEqual([]);
    expect(parseCustomPresets('{"label":"x"}')).toEqual([]);
    expect(parseCustomPresets("[1,2,3]")).toEqual([]);
  });

  it("drops entries that are missing required fields", () => {
    const raw = JSON.stringify([
      { id: "a", label: "Kept", value: "AAAAAA==", createdAt: "2026-09-24T00:00:00.000Z" },
      { id: "b", label: "", value: "AAAAAA==", createdAt: "2026-09-24T00:00:00.000Z" },
      { id: "c", value: "AAAAAA==", createdAt: "2026-09-24T00:00:00.000Z" },
    ]);
    expect(parseCustomPresets(raw).map((p) => p.label)).toEqual(["Kept"]);
  });

  it("caps the list at the documented maximum", () => {
    const many = Array.from({ length: MAX_CUSTOM_PRESETS + 5 }, (_, i) => ({
      id: `id-${i}`,
      label: `Preset ${i}`,
      value: "AAAAAA==",
      createdAt: "2026-09-24T00:00:00.000Z",
    }));
    expect(parseCustomPresets(JSON.stringify(many))).toHaveLength(MAX_CUSTOM_PRESETS);
  });
});

describe("loadCustomPresets", () => {
  it("reads stored presets", () => {
    storage.seed(
      serializeCustomPresets([
        { id: "one", label: "My LedgerKey", value: "AAAABgAAAAEAAAAAAAAAAA==", createdAt: "2026-09-24T00:00:00.000Z" },
      ]),
    );
    expect(loadCustomPresets(storage)).toHaveLength(1);
    expect(loadCustomPresets(storage)[0].label).toBe("My LedgerKey");
  });

  it("returns [] when storage is unavailable (SSR / private mode)", () => {
    expect(loadCustomPresets(null)).toEqual([]);
  });
});

describe("addCustomPreset", () => {
  it("saves a preset and persists it", () => {
    const result = addCustomPreset("  My XDR  ", "  AAAAAA==  ", [], storage, Date.parse("2026-09-24T12:00:00Z"));
    expect(result.ok).toBe(true);
    expect(result.presets).toHaveLength(1);
    expect(result.presets[0].label).toBe("My XDR");
    expect(result.presets[0].value).toBe("AAAAAA==");
    expect(loadCustomPresets(storage)).toHaveLength(1);
  });

  it("puts the newest preset first", () => {
    const first = addCustomPreset("One", "AAAAAA==", [], storage, 1);
    const second = addCustomPreset("Two", "AAAABAAAAAA=", first.presets, storage, 2);
    expect(second.presets.map((p) => p.label)).toEqual(["Two", "One"]);
  });

  it("rejects an empty label", () => {
    const result = addCustomPreset("   ", "AAAAAA==", [], storage);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/label/i);
    expect(result.presets).toEqual([]);
  });

  it("rejects an empty value", () => {
    const result = addCustomPreset("Empty value", "  ", [], storage);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no XDR value/i);
  });

  it("rejects labels past the limit", () => {
    const result = addCustomPreset("x".repeat(MAX_PRESET_LABEL_LENGTH + 1), "AAAAAA==", [], storage);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(String(MAX_PRESET_LABEL_LENGTH));
  });

  it("rejects a duplicate label regardless of case", () => {
    const first = addCustomPreset("My Preset", "AAAAAA==", [], storage, 1);
    const result = addCustomPreset("my preset", "AAAABAAAAAA=", first.presets, storage, 2);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/already exists/i);
    expect(result.presets).toHaveLength(1);
  });

  it("refuses to save past the maximum number of presets", () => {
    const full: CustomXdrPreset[] = Array.from({ length: MAX_CUSTOM_PRESETS }, (_, i) => ({
      id: `id-${i}`,
      label: `Preset ${i}`,
      value: "AAAAAA==",
      createdAt: "2026-09-24T00:00:00.000Z",
    }));
    const result = addCustomPreset("One too many", "AAAAAA==", full, storage);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(String(MAX_CUSTOM_PRESETS));
    expect(result.presets).toHaveLength(MAX_CUSTOM_PRESETS);
  });

  it("does not claim success when the browser refuses to persist (quota)", () => {
    storage.throwOnSet = true;
    const result = addCustomPreset("Quota", "AAAAAA==", [], storage);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/quota|storage/i);
    expect(result.presets).toEqual([]);
  });

  it("does not claim success when storage is unavailable", () => {
    const result = addCustomPreset("No storage", "AAAAAA==", [], null);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unavailable/i);
  });
});

describe("removeCustomPreset", () => {
  it("deletes a preset and persists the shorter list", () => {
    const added = addCustomPreset("Keep", "AAAAAA==", [], storage, 1);
    const withTwo = addCustomPreset("Drop", "AAAABAAAAAA=", added.presets, storage, 2);
    const remaining = removeCustomPreset(withTwo.presets[0].id, withTwo.presets, storage);
    expect(remaining.map((p) => p.label)).toEqual(["Keep"]);
    expect(loadCustomPresets(storage).map((p) => p.label)).toEqual(["Keep"]);
  });

  it("is a no-op for an unknown id", () => {
    const added = addCustomPreset("Keep", "AAAAAA==", [], storage, 1);
    const remaining = removeCustomPreset("missing-id", added.presets, storage);
    expect(remaining).toEqual(added.presets);
  });
});

describe("createPresetId", () => {
  it("builds a slugged, unique id", () => {
    const a = createPresetId("SEP-41 Token Balance!", 1000);
    const b = createPresetId("SEP-41 Token Balance!", 2000);
    expect(a).toMatch(/^sep-41-token-balance-/);
    expect(a).not.toBe(b);
  });

  it("falls back to a generic slug when the label has no usable characters", () => {
    expect(createPresetId("!!!", 1000)).toMatch(/^preset-/);
  });
});
