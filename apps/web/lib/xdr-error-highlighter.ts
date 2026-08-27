/**
 * Turn a raw XDR decode exception into a friendly, offset-aware message. (#927)
 */
export interface XdrDecodeErrorInfo {
  message: string;
  charOffset: number | null;
  suggestion: string;
}

export function explainXdrDecodeError(error: unknown, rawInput: string): XdrDecodeErrorInfo {
  const message = error instanceof Error ? error.message : String(error);

  if (rawInput.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(rawInput)) {
    const badCharIndex = [...rawInput].findIndex((c) => !/[A-Za-z0-9+/=]/.test(c));
    return {
      message,
      charOffset: badCharIndex >= 0 ? badCharIndex : rawInput.length,
      suggestion: "Invalid base64 padding or character — check for copy/paste truncation.",
    };
  }

  if (/unknown.*(tag|discriminant)/i.test(message)) {
    return {
      message,
      charOffset: null,
      suggestion: "Unknown ScVal tag — the string may not be the XDR type you selected.",
    };
  }

  return {
    message,
    charOffset: null,
    suggestion: "Verify the XDR type selector matches the string you pasted.",
  };
}
