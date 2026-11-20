/**
 * Issue #1105: locate the exact character position of a Base64/XDR decoding
 * failure, so the UI can point at it instead of just showing a generic
 * "decoding failed" message.
 *
 * Scope note: this locates *Base64-syntax* problems precisely (an invalid
 * character, or malformed padding) — the position of a character we can name
 * exactly. Once the Base64 is syntactically valid, a failure to match the
 * selected/auto-detected XDR schema (wrong union discriminant, truncated
 * struct, etc.) comes from @stellar/stellar-sdk's XDR reader, which does not
 * expose a byte offset in its error messages — there is no reliable position
 * to report for that class of failure, so this only returns a location for
 * the Base64-syntax case.
 */

export interface XdrErrorLocation {
  /** 0-indexed character offset into the original (non-whitespace-stripped) input. */
  position: number;
  /** 1-indexed line number (XDR is normally single-line, but pasted input may wrap). */
  line: number;
  /** 1-indexed column within that line. */
  column: number;
  /** Human-readable description, e.g. "Invalid Base64 character '!' at position 12". */
  message: string;
}

const VALID_BASE64_CHAR = /[A-Za-z0-9+/]/;

/**
 * Find the first Base64-syntax problem in `input`: an invalid character, or
 * a `=` padding character that isn't confined to a legal trailing position.
 * Returns null when the input is syntactically valid Base64 (or empty).
 */
export function findBase64ErrorPosition(input: string): XdrErrorLocation | null {
  if (!input) return null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (/\s/.test(ch)) continue;

    if (ch === "=") {
      // Padding is only legal as the last 1-2 non-whitespace characters.
      const rest = input.slice(i + 1).replace(/\s+/g, "");
      const isTrailingPadding = /^=?$/.test(rest);
      if (!isTrailingPadding) {
        return locate(input, i, `Invalid Base64 padding character at position ${i}`);
      }
      continue;
    }

    if (!VALID_BASE64_CHAR.test(ch)) {
      return locate(
        input,
        i,
        `Invalid Base64 character '${ch}' at position ${i}`,
      );
    }
  }

  return null;
}

function locate(input: string, position: number, message: string): XdrErrorLocation {
  const before = input.slice(0, position);
  const lines = before.split("\n");
  return {
    position,
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
    message,
  };
}
