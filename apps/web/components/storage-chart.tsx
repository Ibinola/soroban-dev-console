"use client";

import { useMemo, useState } from "react";
import {
  buildBars,
  buildLines,
  buildPieSlices,
  extractNumericPoints,
  pieSlicePath,
  type ChartType,
  type ChartableEntry,
  type ValueHistory,
} from "@/lib/storage-chart";

const W = 320;
const H = 140;
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];
const color = (i: number) => COLORS[i % COLORS.length];

/** Charts the numeric storage values (bar, line over time, or pie). */
export function StorageChart({
  entries,
  history,
}: {
  entries: ChartableEntry[];
  history: ValueHistory;
}) {
  const [type, setType] = useState<ChartType>("bar");
  const points = useMemo(() => extractNumericPoints(entries), [entries]);
  const bars = useMemo(() => buildBars(points, W, H), [points]);
  const slices = useMemo(() => buildPieSlices(points), [points]);
  const lines = useMemo(
    () => buildLines(history, Object.fromEntries(points.map((p) => [p.id, p.label])), W, H),
    [history, points],
  );

  if (points.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No numeric storage values to chart. Non-numeric values are not shown.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {points.length} numeric value{points.length === 1 ? "" : "s"}
        </span>
        <select
          aria-label="Chart type"
          className="h-8 rounded-md border bg-background px-2 text-xs"
          value={type}
          onChange={(e) => setType(e.target.value as ChartType)}
        >
          <option value="bar">Bar</option>
          <option value="line">Line (over time)</option>
          <option value="pie">Pie</option>
        </select>
      </div>

      {type === "bar" && (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bar chart of numeric storage values" className="w-full">
          {bars.map((b, i) => (
            <g key={b.id}>
              <title>{`${b.label}: ${b.value}`}</title>
              <rect x={b.x} y={b.y} width={b.width} height={b.height} fill={color(i)} />
            </g>
          ))}
        </svg>
      )}

      {type === "line" &&
        (lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Refresh storage at least twice to see how values change over time.
          </p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Line chart of storage values over time" className="w-full">
            {lines.map((l, i) => (
              <polyline key={l.id} points={l.points} fill="none" stroke={color(i)} strokeWidth={2}>
                <title>{l.label}</title>
              </polyline>
            ))}
          </svg>
        ))}

      {type === "pie" &&
        (slices.length === 0 ? (
          <p className="text-sm text-muted-foreground">A pie chart needs at least one positive value.</p>
        ) : (
          <svg viewBox="0 0 120 120" role="img" aria-label="Pie chart of storage values" className="mx-auto h-40 w-40">
            {slices.map((s, i) => (
              <path key={s.id} d={pieSlicePath(s, 60, 60, 55)} fill={color(i)}>
                <title>{`${s.label}: ${s.value} (${s.percent.toFixed(1)}%)`}</title>
              </path>
            ))}
          </svg>
        ))}

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {points.map((p, i) => (
          <li key={p.id} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: color(i) }} />
            <span className="font-mono">{p.label}</span>
            <span className="text-muted-foreground">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
