import { describe, it, expect } from "vitest";
import { matchesPresetSearch, filterPresets } from "./xdr-preset-search";

const presets = [
  { label: "ScVal — true (Bool)", description: "A simple boolean true ScVal" },
  { label: "ScVal — u32(42)", description: "Unsigned 32-bit integer with value 42" },
  { label: "ScVal — Symbol(\"transfer\")", description: "A Symbol ScVal commonly used as an event topic" },
];

describe("matchesPresetSearch (issue #1106)", () => {
  it("matches on label substring, case-insensitively", () => {
    expect(matchesPresetSearch(presets[0], "bool")).toBe(true);
    expect(matchesPresetSearch(presets[0], "BOOL")).toBe(true);
  });

  it("matches on description substring", () => {
    expect(matchesPresetSearch(presets[2], "event topic")).toBe(true);
  });

  it("returns true for an empty/whitespace query", () => {
    expect(matchesPresetSearch(presets[0], "")).toBe(true);
    expect(matchesPresetSearch(presets[0], "   ")).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(matchesPresetSearch(presets[0], "nonexistent")).toBe(false);
  });

  it("works for presets with no description (custom presets)", () => {
    expect(matchesPresetSearch({ label: "My Preset" }, "my")).toBe(true);
    expect(matchesPresetSearch({ label: "My Preset" }, "nope")).toBe(false);
  });
});

describe("filterPresets (issue #1106)", () => {
  it("filters the list down to matching presets", () => {
    expect(filterPresets(presets, "symbol")).toHaveLength(1);
    expect(filterPresets(presets, "ScVal")).toHaveLength(3);
    expect(filterPresets(presets, "zzz")).toHaveLength(0);
  });
});
