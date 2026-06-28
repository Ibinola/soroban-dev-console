import { describe, it, expect } from "vitest";

interface ApiEnvelope<T> {
  data: T;
  error: null | { code: string; message: string };
  meta: { timestamp: string; version: string };
}

function wrapSuccess<T>(data: T): ApiEnvelope<T> {
  return { data, error: null, meta: { timestamp: new Date().toISOString(), version: "1" } };
}

function wrapError(code: string, message: string): ApiEnvelope<null> {
  return { data: null, error: { code, message }, meta: { timestamp: new Date().toISOString(), version: "1" } };
}

describe("API envelope contract", () => {
  it("success envelope has data and null error", () => {
    const env = wrapSuccess({ id: "abc" });
    expect(env.data).toEqual({ id: "abc" });
    expect(env.error).toBeNull();
  });

  it("error envelope has null data and an error object", () => {
    const env = wrapError("NOT_FOUND", "Resource not found");
    expect(env.data).toBeNull();
    expect(env.error?.code).toBe("NOT_FOUND");
    expect(env.error?.message).toBeTruthy();
  });

  it("every envelope includes meta with timestamp and version", () => {
    const env = wrapSuccess(42);
    expect(env.meta.timestamp).toMatch(/^\d{4}-/);
    expect(env.meta.version).toBe("1");
  });
});
