import type { NormalizedContractFunction, NormalizedContractSpec } from "./contract-spec";

export type CompatibilityIssueKind =
  | "function_removed"
  | "input_removed"
  | "input_type_changed"
  | "output_type_changed";

export interface CompatibilityIssue {
  kind: CompatibilityIssueKind;
  severity: "breaking" | "warning";
  message: string;
  fnName: string;
}

export interface CompatibilityReport {
  isCompatible: boolean;
  issues: CompatibilityIssue[];
}

function findFn(
  spec: NormalizedContractSpec,
  name: string,
): NormalizedContractFunction | undefined {
  return spec.functions.find((f) => f.name === name);
}

/**
 * Compares `next` spec against `current` and returns a report of breaking
 * or warning-level changes. Used to guard interface replacement in the ABI store.
 */
export function checkAbiCompatibility(
  current: NormalizedContractSpec,
  next: NormalizedContractSpec,
): CompatibilityReport {
  const issues: CompatibilityIssue[] = [];

  for (const fn of current.functions) {
    const nextFn = findFn(next, fn.name);

    if (!nextFn) {
      issues.push({
        kind: "function_removed",
        severity: "breaking",
        fnName: fn.name,
        message: `Function "${fn.name}" was removed in the new spec.`,
      });
      continue;
    }

    // Check inputs
    for (const input of fn.inputs) {
      const nextInput = nextFn.inputs.find((i) => i.name === input.name);
      if (!nextInput) {
        issues.push({
          kind: "input_removed",
          severity: "breaking",
          fnName: fn.name,
          message: `Input "${input.name}" was removed from "${fn.name}".`,
        });
      } else if (nextInput.type !== input.type) {
        issues.push({
          kind: "input_type_changed",
          severity: "breaking",
          fnName: fn.name,
          message: `Input "${input.name}" type changed from "${input.type}" to "${nextInput.type}" in "${fn.name}".`,
        });
      }
    }

    // Check outputs
    for (let i = 0; i < fn.outputs.length; i++) {
      const nextOut = nextFn.outputs[i];
      if (nextOut && nextOut.type !== fn.outputs[i].type) {
        issues.push({
          kind: "output_type_changed",
          severity: "warning",
          fnName: fn.name,
          message: `Output type changed in "${fn.name}": "${fn.outputs[i].type}" → "${nextOut.type}".`,
        });
      }
    }
  }

  return {
    isCompatible: issues.every((i) => i.severity !== "breaking"),
    issues,
  };
}
