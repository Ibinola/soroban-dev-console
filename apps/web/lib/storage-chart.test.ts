import { describe, expect, it } from "vitest";
import {
  MAX_HISTORY_SAMPLES,
  appendHistory,
  buildBars,
  buildLines,
  buildPieSlices,
  extractNumericPoints,
  pieSlicePath,
} from "./storage-chart";

const entry = (id: string, decodedValue: string | undefined, found = true) => ({
  id,
  keyValue: `key-${id}`,
  decodedValue,
  found,
});

describe("storage chart data (#1307)", () => {
  describe("extractNumericPoints", () => {
    it("keeps numeric values and excludes everything else", () => {
      const points = extractNumericPoints([
        entry("a", "42"),
        entry("b", "-7.5"),
        entry("c", "hello"),
        entry("d", "0x1f"),
        entry("e", '{"x":1}'),
        entry("f", undefined),
        entry("g", "99", false),
        entry("h", " 12 "),
        entry("i", ""),
      ]);
      expect(points.map((p) => [p.id, p.value])).toEqual([
        ["a", 42],
        ["b", -7.5],
        ["h", 12],
      ]);
      expect(points[0].label).toBe("key-a");
    });
  });

  describe("appendHistory", () => {
    it("records samples per key without mutating the input", () => {
      const first = appendHistory({}, [{ id: "a", label: "a", value: 1 }], 100);
      const second = appendHistory(first, [{ id: "a", label: "a", value: 2 }], 200);
      expect(first.a).toHaveLength(1);
      expect(second.a).toEqual([{ t: 100, v: 1 }, { t: 200, v: 2 }]);
    });

    it("caps the number of retained samples", () => {
      let h = {};
      for (let i = 0; i < MAX_HISTORY_SAMPLES + 10; i++) h = appendHistory(h, [{ id: "a", label: "a", value: i }], i);
      const series = (h as Record<string, { v: number }[]>).a;
      expect(series).toHaveLength(MAX_HISTORY_SAMPLES);
      expect(series.at(-1)?.v).toBe(MAX_HISTORY_SAMPLES + 9);
    });
  });

  describe("buildBars", () => {
    it("scales bars to the tallest value", () => {
      const bars = buildBars(
        [
          { id: "a", label: "a", value: 10 },
          { id: "b", label: "b", value: 5 },
        ],
        100,
        50,
        0,
      );
      expect(bars[0]).toMatchObject({ height: 50, y: 0, width: 50, x: 0 });
      expect(bars[1]).toMatchObject({ height: 25, y: 25, x: 50 });
    });

    it("draws negative values below a shared baseline", () => {
      const [pos, neg] = buildBars(
        [
          { id: "a", label: "a", value: 10 },
          { id: "b", label: "b", value: -10 },
        ],
        100,
        100,
        0,
      );
      expect(pos).toMatchObject({ y: 0, height: 50 });
      expect(neg).toMatchObject({ y: 50, height: 50 });
    });

    it("handles empty and all-zero input", () => {
      expect(buildBars([], 100, 50)).toEqual([]);
      expect(buildBars([{ id: "a", label: "a", value: 0 }], 100, 50)[0].height).toBe(0);
    });
  });

  describe("buildLines", () => {
    it("needs at least two samples per series", () => {
      expect(buildLines({ a: [{ t: 1, v: 1 }] }, {}, 100, 50)).toEqual([]);
    });

    it("maps time to x and value to an inverted y", () => {
      const [line] = buildLines(
        { a: [{ t: 0, v: 0 }, { t: 10, v: 10 }] },
        { a: "Balance" },
        100,
        50,
      );
      expect(line.label).toBe("Balance");
      expect(line.points).toBe("0,50 100,0");
      expect(line.sampleCount).toBe(2);
    });
  });

  describe("buildPieSlices", () => {
    it("splits positive values into proportional slices covering 360°", () => {
      const slices = buildPieSlices([
        { id: "a", label: "a", value: 1 },
        { id: "b", label: "b", value: 3 },
        { id: "c", label: "c", value: -5 },
        { id: "d", label: "d", value: 0 },
      ]);
      expect(slices.map((s) => s.id)).toEqual(["a", "b"]);
      expect(slices[0].percent).toBeCloseTo(25);
      expect(slices[1].endAngle).toBeCloseTo(360);
      expect(slices[1].startAngle).toBeCloseTo(slices[0].endAngle);
    });

    it("returns nothing when there is no positive total", () => {
      expect(buildPieSlices([{ id: "a", label: "a", value: -1 }])).toEqual([]);
    });

    it("draws a full circle for a single slice", () => {
      const [slice] = buildPieSlices([{ id: "a", label: "a", value: 5 }]);
      expect(pieSlicePath(slice, 50, 50, 40)).toContain("a 40 40 0 1 0");
      expect(pieSlicePath({ startAngle: 0, endAngle: 90 }, 50, 50, 40)).toMatch(/^M 50 50 L 50 10 A 40 40 0 0 1 90 50 Z$/);
    });
  });
});
