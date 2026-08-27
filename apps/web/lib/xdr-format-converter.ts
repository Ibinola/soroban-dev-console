/**
 * Convert Soroban XDR byte streams between base64 and hexadecimal. (#929)
 */
export function base64ToHex(base64: string): string {
  const bytes = Buffer.from(base64, "base64");
  return bytes.toString("hex");
}

export function hexToBase64(hex: string): string {
  if (!isValidHex(hex)) {
    throw new Error("Invalid hex string: must have an even number of hex digits");
  }
  return Buffer.from(hex, "hex").toString("base64");
}

export function isValidHex(hex: string): boolean {
  return hex.length % 2 === 0 && /^[0-9a-fA-F]*$/.test(hex);
}

export type XdrFormat = "base64" | "hex";

export function convertXdrFormat(value: string, from: XdrFormat, to: XdrFormat): string {
  if (from === to) return value;
  return from === "base64" ? base64ToHex(value) : hexToBase64(value);
}
