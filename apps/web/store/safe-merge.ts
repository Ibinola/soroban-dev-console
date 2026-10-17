/**
 * Hydration guard for persisted Zustand stores.
 *
 * Zustand's default `merge` shallow-copies whatever is in storage over the
 * initial state, so corrupted or hand-edited data (`{"contracts": "oops"}`)
 * would replace an array with a string and crash consumers. `safeMerge`
 * only accepts persisted values whose kind matches the store's current
 * value, never overwrites actions, and ignores unknown keys.
 */

type Kind = "array" | "object" | "null" | "string" | "number" | "boolean" | "bigint" | "undefined" | "function" | "symbol";

function kindOf(value: unknown): Kind {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value as Kind;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return kindOf(value) === "object";
}

export function safeMerge<T extends object>(persisted: unknown, current: T): T {
  if (!isPlainObject(persisted)) return current;

  const merged: Record<string, unknown> = { ...(current as Record<string, unknown>) };
  for (const [key, value] of Object.entries(persisted)) {
    if (!(key in current)) continue;
    const currentValue = (current as Record<string, unknown>)[key];
    const currentKind = kindOf(currentValue);
    if (currentKind === "function") continue;
    // A null/undefined default carries no shape information, so accept the value.
    if (currentKind === "null" || currentKind === "undefined" || kindOf(value) === currentKind) {
      merged[key] = value;
    }
  }
  return merged as T;
}
