import type { NormalizedContractSpec, NormalizedContractFunction } from "@devconsole/soroban-utils";

export type DiffStatus = "added" | "removed" | "changed" | "unchanged";

export interface FunctionDiff {
  name: string;
  status: DiffStatus;
  current?: NormalizedContractFunction;
  proposed?: NormalizedContractFunction;
  changes?: string[];
}

export interface SpecDiff {
  functions: FunctionDiff[];
  summary: {
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
    hasBreakingChanges: boolean;
  };
}

function formatSignature(fn: NormalizedContractFunction): string {
  const inputs = fn.inputs.map((i) => `${i.name}: ${i.type}`).join(", ");
  const outputs = fn.outputs.map((o) => `${o.name}: ${o.type}`).join(", ");
  return `${fn.name}(${inputs})${outputs ? ` -> ${outputs}` : ""}`;
}

function diffSignatures(
  current: NormalizedContractFunction,
  proposed: NormalizedContractFunction,
): string[] {
  const changes: string[] = [];

  if (formatSignature(current) !== formatSignature(proposed)) {
    changes.push("signature changed");
  }

  if (current.inputs.length !== proposed.inputs.length) {
    changes.push(
      `inputs: ${current.inputs.length} -> ${proposed.inputs.length}`,
    );
  } else {
    for (let i = 0; i < current.inputs.length; i++) {
      if (current.inputs[i].type !== proposed.inputs[i].type) {
        changes.push(
          `input "${current.inputs[i].name}": ${current.inputs[i].type} -> ${proposed.inputs[i].type}`,
        );
      }
    }
  }

  if (current.outputs.length !== proposed.outputs.length) {
    changes.push(
      `outputs: ${current.outputs.length} -> ${proposed.outputs.length}`,
    );
  } else {
    for (let i = 0; i < current.outputs.length; i++) {
      if (current.outputs[i].type !== proposed.outputs[i].type) {
        changes.push(
          `output "${current.outputs[i].name}": ${current.outputs[i].type} -> ${proposed.outputs[i].type}`,
        );
      }
    }
  }

  return changes;
}

export function computeSpecDiff(
  currentSpec: NormalizedContractSpec,
  proposedSpec: NormalizedContractSpec,
): SpecDiff {
  const currentMap = new Map(
    currentSpec.functions.map((f) => [f.name, f]),
  );
  const proposedMap = new Map(
    proposedSpec.functions.map((f) => [f.name, f]),
  );

  const functions: FunctionDiff[] = [];
  const allNames = new Set([...currentMap.keys(), ...proposedMap.keys()]);

  for (const name of allNames) {
    const current = currentMap.get(name);
    const proposed = proposedMap.get(name);

    if (current && !proposed) {
      functions.push({
        name,
        status: "removed",
        current,
      });
    } else if (!current && proposed) {
      functions.push({
        name,
        status: "added",
        proposed,
      });
    } else if (current && proposed) {
      const changes = diffSignatures(current, proposed);
      functions.push({
        name,
        status: changes.length > 0 ? "changed" : "unchanged",
        current,
        proposed,
        changes: changes.length > 0 ? changes : undefined,
      });
    }
  }

  functions.sort((a, b) => a.name.localeCompare(b.name));

  const summary = {
    added: functions.filter((f) => f.status === "added").length,
    removed: functions.filter((f) => f.status === "removed").length,
    changed: functions.filter((f) => f.status === "changed").length,
    unchanged: functions.filter((f) => f.status === "unchanged").length,
    hasBreakingChanges: functions.some((f) => f.status === "removed"),
  };

  return { functions, summary };
}
