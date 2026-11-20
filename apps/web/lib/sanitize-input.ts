/**
 * sanitize-input.ts
 *
 * Issue #940: Add input sanitization for custom contract IDs and search parameters.
 *
 * Provides:
 *  - Strict contract ID validation (Soroban format: C followed by 55 uppercase
 *    alphanumeric characters, total 56 chars, base32-encoded).
 *  - HTML / XSS sanitization for arbitrary user-supplied strings that will be
 *    rendered in the DOM.
 *  - Sanitized URL search-param extraction so query-string values are safe
 *    before being displayed or processed.
 *
 * The module is isomorphic: it runs in both server (Node.js) and browser
 * contexts.  DOM-based sanitization (via DOMParser) is used when available
 * and falls back to a regex-based strip in SSR/Node environments.
 */

// ─── Contract ID ─────────────────────────────────────────────────────────────

/**
 * Soroban/Stellar contract addresses start with 'C' followed by 55 uppercase
 * base32 characters (A-Z + 2-7), giving a 56-character string overall.
 *
 * Ref: https://developers.stellar.org/docs/learn/glossary#contract-id
 */
const CONTRACT_ID_REGEX = /^C[A-Z2-7]{55}$/;

export interface ContractIdValidationResult {
  valid: boolean;
  contractId: string | null;
  error?: string;
}

/**
 * Validate and normalise a user-supplied contract ID.
 *
 * @param raw - The raw string from user input / URL params.
 * @returns   Validation result with the sanitised contractId (or null on failure).
 */
export function validateContractId(raw: unknown): ContractIdValidationResult {
  if (typeof raw !== "string") {
    return { valid: false, contractId: null, error: "Contract ID must be a string." };
  }

  // Trim whitespace and uppercase so small casing differences are caught early
  const normalised = raw.trim().toUpperCase();

  if (normalised.length === 0) {
    return { valid: false, contractId: null, error: "Contract ID must not be empty." };
  }

  if (!CONTRACT_ID_REGEX.test(normalised)) {
    return {
      valid: false,
      contractId: null,
      error:
        "Invalid contract ID format. Expected a 56-character Soroban address starting with 'C' (e.g. CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KBO).",
    };
  }

  return { valid: true, contractId: normalised };
}

/**
 * Assert that a value is a valid contract ID.  Throws a TypeError on failure.
 */
export function assertContractId(raw: unknown): string {
  const result = validateContractId(raw);
  if (!result.valid || result.contractId === null) {
    throw new TypeError(result.error ?? "Invalid contract ID.");
  }
  return result.contractId;
}

// ─── HTML / XSS Sanitization ─────────────────────────────────────────────────

/**
 * HTML-escape a string so that it is safe to render inside DOM text nodes.
 *
 * This is intentionally simple: it converts the five XML special characters to
 * their named entity equivalents.  For richer HTML fragments, prefer a dedicated
 * library such as DOMPurify on the client side.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Strip all HTML tags from a string.
 *
 * In browser environments the DOMParser is used for accurate parsing.  In
 * server / test environments a regex strip is applied as a safe fallback.
 */
export function stripHtml(value: string): string {
  if (typeof window !== "undefined" && typeof window.DOMParser !== "undefined") {
    try {
      const doc = new window.DOMParser().parseFromString(value, "text/html");
      return doc.body.textContent ?? "";
    } catch {
      // Fall through to regex fallback
    }
  }
  // SSR / Node fallback: strip all tags
  return value.replace(/<[^>]*>/g, "");
}

/**
 * Sanitize a string that originates from user input and will be inserted into
 * the DOM (e.g. as visible text in a label, tooltip or notification).
 *
 * 1. Trims leading/trailing whitespace.
 * 2. Strips embedded HTML tags.
 * 3. Collapses consecutive whitespace to a single space.
 * 4. Enforces an optional maximum length.
 */
export function sanitizeUserString(
  value: unknown,
  options: { maxLength?: number } = {},
): string {
  if (typeof value !== "string") return "";
  const stripped = stripHtml(value.trim());
  const collapsed = stripped.replace(/\s+/g, " ");
  const { maxLength } = options;
  return typeof maxLength === "number" ? collapsed.slice(0, maxLength) : collapsed;
}

// ─── Search Parameter Sanitization ───────────────────────────────────────────

/**
 * Extract and sanitize a URL search parameter by name.
 *
 * Accepts a `URLSearchParams` instance, a `URL` object, or a raw query string
 * (with or without the leading `?`).
 *
 * @returns  The sanitised string value, or `null` if the parameter is absent.
 */
export function sanitizeSearchParam(
  source: URLSearchParams | URL | string,
  name: string,
  options: { maxLength?: number } = {},
): string | null {
  let params: URLSearchParams;

  if (source instanceof URLSearchParams) {
    params = source;
  } else if (source instanceof URL) {
    params = source.searchParams;
  } else {
    // Raw query string
    const qs = source.startsWith("?") ? source.slice(1) : source;
    try {
      params = new URLSearchParams(qs);
    } catch {
      return null;
    }
  }

  const raw = params.get(name);
  if (raw === null) return null;

  return sanitizeUserString(raw, options);
}

/**
 * Extract and sanitize ALL search parameters from a query source.
 *
 * @returns  A plain object mapping param names to their sanitised values.
 */
export function sanitizeAllSearchParams(
  source: URLSearchParams | URL | string,
  options: { maxLength?: number } = {},
): Record<string, string> {
  let params: URLSearchParams;

  if (source instanceof URLSearchParams) {
    params = source;
  } else if (source instanceof URL) {
    params = source.searchParams;
  } else {
    const qs = source.startsWith("?") ? source.slice(1) : source;
    try {
      params = new URLSearchParams(qs);
    } catch {
      return {};
    }
  }

  const result: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    const sanitisedKey = sanitizeUserString(key, { maxLength: 128 });
    if (sanitisedKey) {
      result[sanitisedKey] = sanitizeUserString(value, options);
    }
  }
  return result;
}

// ─── Convenience re-export ────────────────────────────────────────────────────

export const inputSanitizer = {
  validateContractId,
  assertContractId,
  escapeHtml,
  stripHtml,
  sanitizeUserString,
  sanitizeSearchParam,
  sanitizeAllSearchParams,
} as const;

export default inputSanitizer;
