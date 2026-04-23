export interface XdrPreset {
  label: string;
  description: string;
  type: "ScVal" | "TransactionEnvelope" | "LedgerKey";
  value: string;
}

/**
 * Common Soroban XDR presets for the encode/decode workbench.
 * All values are base64-encoded XDR strings.
 */
export const XDR_PRESETS: XdrPreset[] = [
  {
    label: "ScVal — true (Bool)",
    description: "A simple boolean true ScVal",
    type: "ScVal",
    value: "AAAAAAAAAAE=",
  },
  {
    label: "ScVal — u32(42)",
    description: "Unsigned 32-bit integer with value 42",
    type: "ScVal",
    value: "AAAABAAAAAA=",
  },
  {
    label: "ScVal — Symbol(\"transfer\")",
    description: "A Symbol ScVal commonly used as an event topic",
    type: "ScVal",
    value: "AAAADwAAAAh0cmFuc2Zlcg==",
  },
  {
    label: "ScVal — i128(1000000)",
    description: "Signed 128-bit integer — typical token amount",
    type: "ScVal",
    value: "AAAAFQAAAAAAAAAAAAAAAAAAD0JA",
  },
  {
    label: "ScVal — Void",
    description: "A void / null ScVal returned by void functions",
    type: "ScVal",
    value: "AAAAA",
  },
];

export function getPresetsByType(type: XdrPreset["type"]): XdrPreset[] {
  return XDR_PRESETS.filter((p) => p.type === type);
}
