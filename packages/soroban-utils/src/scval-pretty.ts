import { scValToNative, type xdr } from "@stellar/stellar-sdk";

export interface PrettyPrintOptions {
  /** Spaces per indent level (default 2). `0` prints on a single line. */
  indent?: number;
  /** Containers nested deeper than this print as `…` (default: unlimited). */
  maxDepth?: number;
  /** Bytes shown before truncating with `…` (default 32). */
  maxBytes?: number;
  /** Sort map entries by their printed key (default false: preserve order). */
  sortMapKeys?: boolean;
  /** Prefix leaves with their type, e.g. `u32(7)` (default false). */
  showTypes?: boolean;
}

function hex(bytes: Uint8Array, maxBytes: number): string {
  const shown = Buffer.from(bytes.subarray(0, maxBytes)).toString("hex");
  return bytes.length > maxBytes ? `0x${shown}… (${bytes.length} bytes)` : `0x${shown}`;
}

function leaf(type: string, text: string, showTypes: boolean): string {
  return showTypes ? `${type}(${text})` : text;
}

/** Human-readable rendering of a Soroban `ScVal`. */
export function prettyPrintScVal(value: xdr.ScVal, options: PrettyPrintOptions = {}): string {
  const { indent = 2, maxDepth = Infinity, maxBytes = 32, sortMapKeys = false, showTypes = false } = options;

  const render = (v: xdr.ScVal, depth: number): string => {
    const pad = (level: number) => (indent > 0 ? "\n" + " ".repeat(indent * level) : "");
    const sw = v.type;

    const container = (open: string, close: string, items: string[]): string => {
      if (items.length === 0) return open + close;
      if (indent === 0) return `${open}${items.join(", ")}${close}`;
      return `${open}${items.map((i) => pad(depth + 1) + i).join(",")}${pad(depth)}${close}`;
    };

    switch (sw) {
      case "scvVoid":
        return "void";
      case "scvBool":
        return leaf("bool", String(scValToNative(v)), showTypes);
      case "scvU32":
        return leaf("u32", String(scValToNative(v)), showTypes);
      case "scvI32":
        return leaf("i32", String(scValToNative(v)), showTypes);
      case "scvSymbol":
        return leaf("symbol", String(scValToNative(v)), showTypes);
      case "scvString":
        return leaf("string", JSON.stringify(String(scValToNative(v))), showTypes);
      case "scvBytes":
        return leaf("bytes", hex(scValToNative(v) as Uint8Array, maxBytes), showTypes);
      case "scvAddress":
        return leaf("address", String(scValToNative(v)), showTypes);
      case "scvVec": {
        if (depth >= maxDepth) return "[…]";
        return container("[", "]", (v.vec ?? []).map((item) => render(item, depth + 1)));
      }
      case "scvMap": {
        if (depth >= maxDepth) return "{…}";
        let entries = (v.map ?? []).map(
          (e) => [render(e.key, depth + 1), render(e.val, depth + 1)] as const,
        );
        if (sortMapKeys) entries = [...entries].sort(([a], [b]) => a.localeCompare(b));
        return container("{", "}", entries.map(([k, val]) => `${k}: ${val}`));
      }
      case "scvError":
        return `error(${v.error.type})`;
      default: {
        // Remaining numeric types (u64/i64/u128/i128/u256/i256/timepoint/duration).
        const type = sw.replace(/^scv/, "").toLowerCase();
        return leaf(type, String(scValToNative(v)), showTypes);
      }
    }
  };

  return render(value, 0);
}
