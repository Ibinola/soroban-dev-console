import type {
  NormalizedContractField,
  NormalizedContractFunction,
  NormalizedContractSpec,
} from "./contract-spec";

/** One change to a function's signature, in deterministic order. */
export type SignatureChange =
  | { kind: "input-added"; name: string; type: string; required: boolean }
  | { kind: "input-removed"; name: string; type: string }
  | { kind: "input-type-changed"; name: string; from: string; to: string }
  | { kind: "input-required-changed"; name: string; from: boolean; to: boolean }
  | { kind: "input-order-changed"; from: string[]; to: string[] }
  | { kind: "output-changed"; from: string[]; to: string[] };

export interface FunctionChange {
  name: string;
  changes: SignatureChange[];
}

/** Types in the report are the argument/return type names the spec uses. */
export interface SpecTypeDiff {
  added: string[];
  removed: string[];
}

export interface SpecCompatibilityReport {
  functions: {
    added: string[];
    removed: string[];
    signatureChanged: FunctionChange[];
  };
  types: SpecTypeDiff;
  /** True when nothing a caller depends on was removed or changed. */
  backwardCompatible: boolean;
  summary: { added: number; removed: number; changed: number };
}

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function typesOf(spec: NormalizedContractSpec): Set<string> {
  const out = new Set<string>();
  for (const fn of spec.functions) {
    for (const f of [...fn.inputs, ...fn.outputs]) out.add(f.type);
  }
  return out;
}

function diffFunction(before: NormalizedContractFunction, after: NormalizedContractFunction): SignatureChange[] {
  const changes: SignatureChange[] = [];
  const beforeIn = new Map(before.inputs.map((f) => [f.name, f] as const));
  const afterIn = new Map(after.inputs.map((f) => [f.name, f] as const));

  for (const name of [...afterIn.keys()].sort(byString)) {
    const next = afterIn.get(name) as NormalizedContractField;
    const prev = beforeIn.get(name);
    if (!prev) {
      changes.push({ kind: "input-added", name, type: next.type, required: next.required });
      continue;
    }
    if (prev.type !== next.type) changes.push({ kind: "input-type-changed", name, from: prev.type, to: next.type });
    if (prev.required !== next.required) {
      changes.push({ kind: "input-required-changed", name, from: prev.required, to: next.required });
    }
  }
  for (const name of [...beforeIn.keys()].sort(byString)) {
    if (!afterIn.has(name)) {
      changes.push({ kind: "input-removed", name, type: (beforeIn.get(name) as NormalizedContractField).type });
    }
  }

  // Arguments are positional on-chain, so a pure reorder is a real change.
  const common = before.inputs.map((f) => f.name).filter((n) => afterIn.has(n));
  const commonAfter = after.inputs.map((f) => f.name).filter((n) => beforeIn.has(n));
  if (common.join("\u0000") !== commonAfter.join("\u0000")) {
    changes.push({ kind: "input-order-changed", from: common, to: commonAfter });
  }

  const outBefore = before.outputs.map((f) => f.type);
  const outAfter = after.outputs.map((f) => f.type);
  if (outBefore.join("\u0000") !== outAfter.join("\u0000")) {
    changes.push({ kind: "output-changed", from: outBefore, to: outAfter });
  }
  return changes;
}

/**
 * Compare two spec revisions. Function order in either spec is irrelevant;
 * everything in the report is sorted, so equivalent specs always produce the
 * same report. Documentation text and metadata (`doc`, `rawSpec`, timestamps)
 * are not part of the comparison.
 */
export function compareContractSpecs(
  before: NormalizedContractSpec,
  after: NormalizedContractSpec,
): SpecCompatibilityReport {
  const beforeFns = new Map(before.functions.map((f) => [f.name, f] as const));
  const afterFns = new Map(after.functions.map((f) => [f.name, f] as const));

  const added = [...afterFns.keys()].filter((n) => !beforeFns.has(n)).sort(byString);
  const removed = [...beforeFns.keys()].filter((n) => !afterFns.has(n)).sort(byString);
  const signatureChanged: FunctionChange[] = [];
  for (const name of [...afterFns.keys()].filter((n) => beforeFns.has(n)).sort(byString)) {
    const changes = diffFunction(beforeFns.get(name) as NormalizedContractFunction, afterFns.get(name) as NormalizedContractFunction);
    if (changes.length > 0) signatureChanged.push({ name, changes });
  }

  const beforeTypes = typesOf(before);
  const afterTypes = typesOf(after);
  const types: SpecTypeDiff = {
    added: [...afterTypes].filter((t) => !beforeTypes.has(t)).sort(byString),
    removed: [...beforeTypes].filter((t) => !afterTypes.has(t)).sort(byString),
  };

  // Adding a function, or an optional trailing input, does not break callers.
  const breakingChange = signatureChanged.some((fn) =>
    fn.changes.some((c) => c.kind !== "input-added" || c.required),
  );
  return {
    functions: { added, removed, signatureChanged },
    types,
    backwardCompatible: removed.length === 0 && !breakingChange,
    summary: { added: added.length, removed: removed.length, changed: signatureChanged.length },
  };
}
