export interface TemplateInput {
  name: string;
  type: string;
}

export interface ParamTemplate {
  id: string;
  label: string;
  /** One value per input, in order. `undefined` leaves the field untouched. */
  values: (string | undefined)[];
}

/** One token unit with the standard 7 Stellar decimals. */
export const ONE_TOKEN_STROOPS = "10000000";

const AMOUNT_NAME = /amount|value|quantity|supply|balance/i;
const NUMERIC = new Set(["i32", "u32", "i128", "u128"]);

function defaultFor(type: string): string | undefined {
  if (NUMERIC.has(type)) return "0";
  if (type === "bool") return "false";
  if (type === "string" || type === "symbol") return "";
  if (type === "vec") return "[]";
  if (type === "map") return "{}";
  // Addresses and bytes have no meaningful default.
  return undefined;
}

/**
 * Templates for common parameter patterns, derived from a function's
 * inputs. Only templates that would change at least one field are returned.
 */
export function templatesForInputs(inputs: TemplateInput[]): ParamTemplate[] {
  if (inputs.length === 0) return [];
  const out: ParamTemplate[] = [];

  const defaults = inputs.map((i) => defaultFor(i.type));
  if (defaults.some((v) => v !== undefined)) {
    out.push({ id: "defaults", label: "Type defaults (0 / false / empty)", values: defaults });
  }

  const oneToken = inputs.map((i) =>
    NUMERIC.has(i.type) && i.type !== "i32" && i.type !== "u32" && AMOUNT_NAME.test(i.name)
      ? ONE_TOKEN_STROOPS
      : undefined,
  );
  if (oneToken.some((v) => v !== undefined)) {
    out.push({ id: "one-token", label: "Amount: 1 token (7 decimals)", values: oneToken });
  }

  const smallAmount = inputs.map((i) =>
    NUMERIC.has(i.type) && AMOUNT_NAME.test(i.name) ? "1" : undefined,
  );
  if (smallAmount.some((v) => v !== undefined)) {
    out.push({ id: "min-amount", label: "Amount: smallest unit (1)", values: smallAmount });
  }

  return out;
}

/** Applies a template, keeping existing values where it has nothing to say. */
export function applyTemplate<T extends { value: unknown }>(args: T[], template: ParamTemplate): T[] {
  return args.map((arg, i) => {
    const v = template.values[i];
    return v === undefined ? arg : { ...arg, value: v };
  });
}
