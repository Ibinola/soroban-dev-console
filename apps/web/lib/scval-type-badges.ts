/**
 * Issue #1109: colour-coded Soroban type badges for decoded ScVal trees.
 *
 * The enum numbers are read from the SDK's own `xdr.ScValType` table instead of
 * being hard-coded here, so the hover tooltip always matches the installed
 * `@stellar/stellar-sdk`.
 */

import { xdr } from "@stellar/stellar-sdk";

type ScValTypeEnum = { schema?: Record<string, unknown> } & Record<string, unknown>;

const ENUM = (xdr as unknown as { ScValType?: ScValTypeEnum }).ScValType;

/** `ledger_key_nonce` → `scvLedgerKeyNonce` (the SDK enum member name). */
export function enumMemberFor(jsonKey: string): string {
  const parts = String(jsonKey ?? "")
    .split(/[_\s-]+/)
    .filter(Boolean);
  return "scv" + parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
}

/** Underlying discriminant, e.g. `vec` → 16. `undefined` when the key is not an ScVal wrapper. */
export function scvalEnumValue(jsonKey: string): number | undefined {
  if (!ENUM) return undefined;
  const member = enumMemberFor(jsonKey);
  const candidates = [ENUM.schema?.[member], ENUM[member]];
  for (const candidate of candidates) {
    if (typeof candidate === "number") return candidate;
  }
  return undefined;
}

/** Wrapper key inside a decoded value, e.g. `{ vec: [] }` → `"vec"`. */
export function scvalWrapperKey(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.keys(value as Record<string, unknown>).find((key) => scvalEnumValue(key) !== undefined);
}

/** `ledger_key_nonce` → `ledger key nonce` for display. */
export function humanizeScvalType(jsonKey: string): string {
  return String(jsonKey ?? "").replace(/_/g, " ");
}

export type ScvalFamily =
  | "bool"
  | "void"
  | "error"
  | "integer"
  | "numeric"
  | "bytes"
  | "text"
  | "collection"
  | "address"
  | "instance";

const FAMILIES: Array<{ family: ScvalFamily; keys: string[] }> = [
  { family: "bool", keys: ["bool"] },
  { family: "void", keys: ["void"] },
  { family: "error", keys: ["error"] },
  { family: "integer", keys: ["u32", "i32", "u64", "i64"] },
  { family: "numeric", keys: ["u128", "i128", "u256", "i256", "timepoint", "duration"] },
  { family: "bytes", keys: ["bytes"] },
  { family: "text", keys: ["string", "symbol"] },
  { family: "collection", keys: ["vec", "map"] },
  { family: "address", keys: ["address"] },
  {
    family: "instance",
    keys: ["contract_instance", "ledger_key_contract_instance", "ledger_key_nonce", "executable_tag"],
  },
];

export function scvalFamily(jsonKey: string): ScvalFamily | undefined {
  return FAMILIES.find((bucket) => bucket.keys.includes(jsonKey))?.family;
}

/** Tailwind classes per family — distinctive, readable on the dark result panel. */
export const SCVAL_BADGE_CLASSES: Record<ScvalFamily, string> = {
  bool: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  void: "border-zinc-500/40 bg-zinc-500/15 text-zinc-300",
  error: "border-red-500/40 bg-red-500/15 text-red-300",
  integer: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  numeric: "border-teal-500/40 bg-teal-500/15 text-teal-300",
  bytes: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  text: "border-violet-500/40 bg-violet-500/15 text-violet-300",
  collection: "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-300",
  address: "border-orange-500/40 bg-orange-500/15 text-orange-300",
  instance: "border-indigo-500/40 bg-indigo-500/15 text-indigo-300",
};

export function scvalBadgeClasses(jsonKey: string): string {
  const family = scvalFamily(jsonKey);
  return family ? SCVAL_BADGE_CLASSES[family] : "border-muted-foreground/40 bg-muted/30 text-muted-foreground";
}

/** Tooltip text: the enum member plus its integer discriminant. */
export function scvalBadgeTitle(jsonKey: string): string {
  const member = enumMemberFor(jsonKey);
  const value = scvalEnumValue(jsonKey);
  return value === undefined ? `ScValType.${member}` : `ScValType.${member} = ${value}`;
}

/** Nested ScVal wrappers inside a decoded wrapper value (vec items, map key/val). */
export function childScvalWrappers(jsonKey: string, wrapperValue: unknown): unknown[] {
  if (jsonKey === "vec") return Array.isArray(wrapperValue) ? wrapperValue : [];
  if (jsonKey === "map" && Array.isArray(wrapperValue)) {
    return wrapperValue.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const { key, val } = entry as { key?: unknown; val?: unknown };
      return [key, val].filter((item) => item !== undefined);
    });
  }
  if (jsonKey === "contract_instance" && wrapperValue && typeof wrapperValue === "object") {
    return Object.values(wrapperValue as Record<string, unknown>);
  }
  return [];
}
