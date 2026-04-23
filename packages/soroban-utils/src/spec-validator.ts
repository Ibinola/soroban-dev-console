import type { NormalizedContractSpec, NormalizedContractFunction } from "./contract-spec";

export type SpecValidationSeverity = "error" | "warning";

export interface SpecValidationIssue {
  severity: SpecValidationSeverity;
  message: string;
  field?: string;
}

export interface SpecValidationResult {
  valid: boolean;
  issues: SpecValidationIssue[];
}

const SUPPORTED_TYPES = new Set([
  "address", "symbol", "string", "bool",
  "i32", "u32", "i64", "u64", "i128", "u128",
  "vec", "map", "bytes", "unknown",
]);

function validateFunction(fn: NormalizedContractFunction): SpecValidationIssue[] {
  const issues: SpecValidationIssue[] = [];

  if (!fn.name || fn.name.trim() === "") {
    issues.push({ severity: "error", message: "Function is missing a name" });
  }

  for (const input of fn.inputs) {
    if (!SUPPORTED_TYPES.has(input.type)) {
      issues.push({
        severity: "warning",
        message: `Unsupported input type "${input.type}" on "${fn.name}.${input.name}"`,
        field: `${fn.name}.${input.name}`,
      });
    }
  }

  for (const output of fn.outputs) {
    if (!SUPPORTED_TYPES.has(output.type)) {
      issues.push({
        severity: "warning",
        message: `Unsupported output type "${output.type}" on "${fn.name}"`,
        field: fn.name,
      });
    }
  }

  return issues;
}

/**
 * Validates a normalized contract spec and returns a list of issues.
 * Errors block ingestion; warnings are informational.
 */
export function validateContractSpec(spec: NormalizedContractSpec): SpecValidationResult {
  const issues: SpecValidationIssue[] = [];

  if (!spec.rawSpec || spec.rawSpec.trim() === "") {
    issues.push({ severity: "error", message: "Raw spec is empty" });
  }

  if (!Array.isArray(spec.functions) || spec.functions.length === 0) {
    issues.push({ severity: "warning", message: "Spec contains no functions" });
  } else {
    for (const fn of spec.functions) {
      issues.push(...validateFunction(fn));
    }
  }

  return {
    valid: issues.every((i) => i.severity !== "error"),
    issues,
  };
}
