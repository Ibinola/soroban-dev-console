import type { ResultBundle } from "@/store/useResultBundlesStore";

export function downloadJsonFile(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportResultBundle(bundle: ResultBundle): void {
  const stamp = new Date(bundle.createdAt).toISOString().slice(0, 19).replace(/:/g, "-");
  downloadJsonFile(`result-bundle-${bundle.kind}-${stamp}.json`, {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    bundle,
  });
}

export function exportAllResultBundles(bundles: ResultBundle[]): void {
  downloadJsonFile(`result-bundles-${new Date().toISOString().slice(0, 10)}.json`, {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    count: bundles.length,
    bundles,
  });
}

export type BundleDiffStatus = "added" | "removed" | "changed" | "unchanged";

export interface BundleFieldDiff {
  path: string;
  status: BundleDiffStatus;
  left?: unknown;
  right?: unknown;
}

function flatten(value: unknown, prefix = "", out: Record<string, unknown> = {}): Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    out[prefix || "(root)"] = value;
    return out;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    flatten(child, path, out);
  }
  return out;
}

/**
 * Compute a field-level diff between two result bundle payloads so the compare
 * view can highlight differences in return values, events, and state changes.
 */
export function diffResultBundles(left: ResultBundle, right: ResultBundle): BundleFieldDiff[] {
  const flatLeft = flatten(left.payload);
  const flatRight = flatten(right.payload);
  const paths = Array.from(new Set([...Object.keys(flatLeft), ...Object.keys(flatRight)])).sort();

  return paths.map((path) => {
    const inLeft = path in flatLeft;
    const inRight = path in flatRight;
    const leftValue = flatLeft[path];
    const rightValue = flatRight[path];

    let status: BundleDiffStatus;
    if (inLeft && !inRight) status = "removed";
    else if (!inLeft && inRight) status = "added";
    else if (JSON.stringify(leftValue) !== JSON.stringify(rightValue)) status = "changed";
    else status = "unchanged";

    return { path, status, left: leftValue, right: rightValue };
  });
}
