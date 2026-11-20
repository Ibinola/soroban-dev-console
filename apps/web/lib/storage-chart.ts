export interface ChartableEntry {
  id: string;
  keyValue: string;
  decodedValue?: string;
  found: boolean;
}

export interface NumericPoint {
  id: string;
  label: string;
  value: number;
}

export type ChartType = "bar" | "line" | "pie";

const NUMERIC = /^-?\d+(\.\d+)?$/;

/** Numeric storage values only; everything else is excluded from charts. */
export function extractNumericPoints(entries: ChartableEntry[]): NumericPoint[] {
  const points: NumericPoint[] = [];
  for (const e of entries) {
    if (!e.found || e.decodedValue === undefined) continue;
    const text = e.decodedValue.trim();
    if (!NUMERIC.test(text)) continue;
    const value = Number(text);
    if (Number.isFinite(value)) points.push({ id: e.id, label: e.keyValue, value });
  }
  return points;
}

export interface HistorySample {
  t: number;
  v: number;
}

export type ValueHistory = Record<string, HistorySample[]>;

export const MAX_HISTORY_SAMPLES = 50;

/** Records the current values; samples are kept per key, newest last, capped. */
export function appendHistory(history: ValueHistory, points: NumericPoint[], t: number): ValueHistory {
  const next: ValueHistory = { ...history };
  for (const p of points) {
    const series = [...(next[p.id] ?? []), { t, v: p.value }];
    next[p.id] = series.slice(-MAX_HISTORY_SAMPLES);
  }
  return next;
}

export interface Bar {
  id: string;
  label: string;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bars share a zero baseline so negative values extend downwards. */
export function buildBars(points: NumericPoint[], width: number, height: number, gap = 6): Bar[] {
  if (points.length === 0) return [];
  const max = Math.max(0, ...points.map((p) => p.value));
  const min = Math.min(0, ...points.map((p) => p.value));
  const span = max - min || 1;
  const baseline = (max / span) * height;
  const barWidth = Math.max(1, (width - gap * (points.length - 1)) / points.length);
  return points.map((p, i) => {
    const h = (Math.abs(p.value) / span) * height;
    return {
      id: p.id,
      label: p.label,
      value: p.value,
      x: i * (barWidth + gap),
      y: p.value >= 0 ? baseline - h : baseline,
      width: barWidth,
      height: h,
    };
  });
}

export interface LineSeries {
  id: string;
  label: string;
  /** SVG `points` attribute value. */
  points: string;
  sampleCount: number;
}

/** One polyline per key that has at least two samples, on a shared time/value scale. */
export function buildLines(
  history: ValueHistory,
  labels: Record<string, string>,
  width: number,
  height: number,
): LineSeries[] {
  const entries = Object.entries(history).filter(([, s]) => s.length >= 2);
  if (entries.length === 0) return [];
  const all = entries.flatMap(([, s]) => s);
  const tMin = Math.min(...all.map((s) => s.t));
  const tMax = Math.max(...all.map((s) => s.t));
  const vMin = Math.min(...all.map((s) => s.v));
  const vMax = Math.max(...all.map((s) => s.v));
  const tSpan = tMax - tMin || 1;
  const vSpan = vMax - vMin || 1;
  return entries.map(([id, samples]) => ({
    id,
    label: labels[id] ?? id,
    sampleCount: samples.length,
    points: samples
      .map((s) => {
        const x = ((s.t - tMin) / tSpan) * width;
        const y = height - ((s.v - vMin) / vSpan) * height;
        return `${round(x)},${round(y)}`;
      })
      .join(" "),
  }));
}

export interface PieSlice {
  id: string;
  label: string;
  value: number;
  percent: number;
  startAngle: number;
  endAngle: number;
}

/** Pie slices for positive values (a pie cannot show negative or zero shares). */
export function buildPieSlices(points: NumericPoint[]): PieSlice[] {
  const positive = points.filter((p) => p.value > 0);
  const total = positive.reduce((sum, p) => sum + p.value, 0);
  if (total === 0) return [];
  let angle = 0;
  return positive.map((p) => {
    const sweep = (p.value / total) * 360;
    const slice = {
      id: p.id,
      label: p.label,
      value: p.value,
      percent: (p.value / total) * 100,
      startAngle: angle,
      endAngle: angle + sweep,
    };
    angle += sweep;
    return slice;
  });
}

/** SVG path for a pie slice centred at (cx, cy). */
export function pieSlicePath(slice: Pick<PieSlice, "startAngle" | "endAngle">, cx: number, cy: number, r: number): string {
  const sweep = slice.endAngle - slice.startAngle;
  if (sweep >= 359.999) {
    return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;
  }
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${round(cx + r * Math.cos(rad))} ${round(cy + r * Math.sin(rad))}`;
  };
  const large = sweep > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${point(slice.startAngle)} A ${r} ${r} 0 ${large} 1 ${point(slice.endAngle)} Z`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
