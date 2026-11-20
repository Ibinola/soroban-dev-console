import { describe, it, expect } from "vitest";
import {
  toBase64Url,
  fromBase64Url,
  buildXdrShareQuery,
  parseXdrShareQuery,
  MAX_SHARE_URL_LENGTH,
} from "./page";

describe("XDR share link encoding (issue #1110)", () => {
  it("round-trips base64 <-> base64url for a typical XDR payload", () => {
    const base64 = "AAAAAgAAAAB7v2dX/////wAAAAAAAAAAAAAAAAAA+/8=";
    const url = toBase64Url(base64);
    expect(url).not.toContain("+");
    expect(url).not.toContain("/");
    expect(url).not.toContain("=");
    expect(fromBase64Url(url)).toBe(base64);
  });

  it("builds a share query and parses it back to the original type + payload", () => {
    const xdr = "AAAAAgAAAAB7v2dX/////wAAAAAAAAAAAAAAAAAA+/8=";
    const query = buildXdrShareQuery({ typeHint: "auto", xdr });

    const parsed = parseXdrShareQuery(new URLSearchParams(query));
    expect(parsed).toEqual({ typeHint: "auto", xdr });
  });

  it("preserves a non-auto type hint through the round trip", () => {
    const xdr = "AAAAEgAAAAAAAAAA";
    const query = buildXdrShareQuery({ typeHint: "ScVal", xdr });
    const parsed = parseXdrShareQuery(new URLSearchParams(query));
    expect(parsed?.typeHint).toBe("ScVal");
  });

  it("returns null when no xdr param is present", () => {
    expect(parseXdrShareQuery(new URLSearchParams("type=auto"))).toBeNull();
    expect(parseXdrShareQuery(new URLSearchParams(""))).toBeNull();
  });

  it("defaults to 'auto' when type is omitted", () => {
    const xdr = "AAAAEgAAAAAAAAAA";
    const parsed = parseXdrShareQuery(new URLSearchParams(`xdr=${toBase64Url(xdr)}`));
    expect(parsed?.typeHint).toBe("auto");
  });

  it("exposes a sane max URL length threshold", () => {
    expect(MAX_SHARE_URL_LENGTH).toBeGreaterThan(0);
    expect(MAX_SHARE_URL_LENGTH).toBeLessThanOrEqual(8192);
  });
});
