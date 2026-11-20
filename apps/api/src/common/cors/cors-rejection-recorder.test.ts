import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CORS_MAX_LOGS_PER_MINUTE,
  CORS_WINDOW_MS,
  CorsRejectionRecorder,
  isOriginAllowed,
  mapCorsRejectionToAuditEntry,
  resolveCorsAllowlist,
} from "./cors-rejection-recorder.js";

describe("cors rejection recorder", () => {
  it("allows the first five log entries per origin then throttles", () => {
    const recorder = new CorsRejectionRecorder();
    const now = 1_000_000;

    for (let i = 0; i < CORS_MAX_LOGS_PER_MINUTE; i++) {
      assert.equal(recorder.note("https://evil.example", now), true, `note ${i + 1}`);
    }
    assert.equal(recorder.note("https://evil.example", now), false, "6th within window");
    assert.equal(recorder.wantsLog("https://evil.example", now), false);
  });

  it("resets the budget once the sliding window elapses", () => {
    const recorder = new CorsRejectionRecorder();
    const start = 1_000_000;

    for (let i = 0; i < CORS_MAX_LOGS_PER_MINUTE; i++) {
      recorder.note("https://evil.example", start);
    }
    assert.equal(recorder.note("https://evil.example", start), false);

    assert.equal(recorder.note("https://evil.example", start + CORS_WINDOW_MS), true);
    assert.equal(recorder.wantsLog("https://evil.example", start + CORS_WINDOW_MS), true);
  });

  it("tracks origins independently", () => {
    const recorder = new CorsRejectionRecorder();
    const now = 1_000_000;

    for (let i = 0; i < CORS_MAX_LOGS_PER_MINUTE; i++) {
      recorder.note("https://a.example", now);
    }
    assert.equal(recorder.note("https://b.example", now), true);
    assert.equal(recorder.note("https://a.example", now), false);
  });

  it("maps a rejected origin into a CORS_ORIGIN_REJECTED audit entry", () => {
    const entry = mapCorsRejectionToAuditEntry("https://evil.example:8443", "/api/shares");

    assert.equal(entry.action, "cors.origin.rejected");
    assert.equal(entry.resourceType, "http");
    assert.equal(entry.resourceId, "/api/shares");
    assert.deepEqual(entry.metadata, {
      origin: "https://evil.example:8443",
      domain: "evil.example",
      path: "/api/shares",
    });
  });

  it("keeps an unparsable origin verbatim in the audit entry", () => {
    const entry = mapCorsRejectionToAuditEntry("not-a-url", "/");
    assert.equal(entry.metadata.domain, "not-a-url");
  });
});

describe("cors allowlist helpers", () => {
  const ORIGINAL: Record<string, string | undefined> = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in ORIGINAL)) delete process.env[key];
    }
    Object.assign(process.env, ORIGINAL);
  });

  it("resolves the comma-separated ALLOWED_ORIGINS allowlist", () => {
    process.env.ALLOWED_ORIGINS = " https://app.example.com , https://admin.example.com ";
    assert.deepEqual(resolveCorsAllowlist(), [
      "https://app.example.com",
      "https://admin.example.com",
    ]);
  });

  it("falls back to the legacy CORS_ORIGINS alias", () => {
    delete process.env.ALLOWED_ORIGINS;
    process.env.CORS_ORIGINS = "https://legacy.example.com";
    assert.deepEqual(resolveCorsAllowlist(), ["https://legacy.example.com"]);
  });

  it("denies all origins in production without an explicit allowlist", () => {
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.CORS_ORIGINS;
    process.env.NODE_ENV = "production";
    assert.deepEqual(resolveCorsAllowlist(), []);
    assert.equal(isOriginAllowed("https://anything.example", resolveCorsAllowlist()), false);
  });

  it("defaults to WEB_ORIGIN (or localhost) outside production", () => {
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.CORS_ORIGINS;
    delete process.env.NODE_ENV;
    delete process.env.WEB_ORIGIN;
    assert.deepEqual(resolveCorsAllowlist(), ["http://localhost:3000"]);

    process.env.WEB_ORIGIN = "http://dev.example:5173";
    assert.deepEqual(resolveCorsAllowlist(), ["http://dev.example:5173"]);
  });

  it("checks membership against the allowlist", () => {
    const allowlist = ["https://app.example.com"];
    assert.equal(isOriginAllowed("https://app.example.com", allowlist), true);
    assert.equal(isOriginAllowed("https://evil.example.com", allowlist), false);
  });
});