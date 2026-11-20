import { Memo } from "@stellar/stellar-sdk";

/**
 * Validate and build a transaction Memo from a type/value pair. (#900)
 */
export type MemoKind = "text" | "id" | "hash" | "return";

export function validateMemoValue(kind: MemoKind, value: string): string | null {
  if (kind === "text" && Buffer.byteLength(value, "utf-8") > 28) {
    return "Text memo must be at most 28 bytes";
  }
  if (kind === "id" && !/^\d+$/.test(value)) {
    return "ID memo must be a non-negative integer";
  }
  if ((kind === "hash" || kind === "return") && !/^[0-9a-fA-F]{64}$/.test(value)) {
    return `${kind} memo must be a 32-byte hex string`;
  }
  return null;
}

export function buildMemo(kind: MemoKind, value: string): Memo {
  switch (kind) {
    case "text":
      return Memo.text(value);
    case "id":
      return Memo.id(value);
    case "hash":
      return Memo.hash(value);
    case "return":
      return Memo.return(value);
  }
}
