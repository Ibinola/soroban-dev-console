import type { NormalizedContractFunction, NormalizedContractSpec } from "@devconsole/soroban-utils";
import { computeSpecDiff, type SpecDiff } from "@/lib/spec-diff";
import type { ContractVersionSnapshot } from "@/store/useContractVersionStore";

/** A selectable version in the history UI: a snapshot or the live ABI. */
export interface VersionOption {
  key: string;
  label: string;
  spec: NormalizedContractSpec;
}

export const CURRENT_VERSION_KEY = "current";

export function formatFunctionSignature(fn: NormalizedContractFunction): string {
  const inputs = fn.inputs.map((i) => `${i.name}: ${i.type}`).join(", ");
  const outputs = fn.outputs.map((o) => o.type).join(", ");
  return `${fn.name}(${inputs})${outputs ? ` -> ${outputs}` : ""}`;
}

/** Newest first, with the live ABI (if any) at the top as "Current". */
export function buildVersionOptions(
  snapshots: ContractVersionSnapshot[],
  currentSpec: NormalizedContractSpec | undefined,
): VersionOption[] {
  const options: VersionOption[] = [];
  if (currentSpec) options.push({ key: CURRENT_VERSION_KEY, label: "Current", spec: currentSpec });
  for (const s of [...snapshots].sort((a, b) => b.version - a.version)) {
    options.push({
      key: s.id,
      label: `v${s.version} · ${new Date(s.recordedAt).toISOString().slice(0, 16).replace("T", " ")}`,
      spec: s.spec,
    });
  }
  return options;
}

/** Diff from the older version `from` to the newer version `to`. */
export function diffVersions(from: NormalizedContractSpec, to: NormalizedContractSpec): SpecDiff {
  return computeSpecDiff(from, to);
}
