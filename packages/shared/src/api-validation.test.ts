import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  ApiValidationError,
  logApiValidationFailure,
  parseApiResponse,
  safeParseApiResponse,
} from "./api-validation";

const schema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(z.object({ id: z.string().min(2), role: z.enum(["admin", "user"]) })),
    token: z.string(),
  }),
});

describe("runtime API response validators (#1399)", () => {
  const good = { success: true as const, data: { items: [{ id: "ab", role: "user" as const }], token: "t" } };

  it("returns the typed payload on success", () => {
    const out = parseApiResponse(schema, good, "GET /items");
    // Compile-time check: inferred type keeps the enum literal.
    const role: "admin" | "user" = out.data.items[0].role;
    assert.equal(role, "user");
  });

  it("reports the endpoint and normalized field paths on failure", () => {
    const bad = { success: true, data: { items: [{ id: "ab", role: "user" }, { id: 5, role: "root" }], token: "t" } };
    assert.throws(
      () => parseApiResponse(schema, bad, "GET /items"),
      (e: unknown) => {
        assert.ok(e instanceof ApiValidationError);
        assert.equal(e.endpoint, "GET /items");
        assert.deepEqual(e.issues.map((i) => i.path).sort(), ["data.items[1].id", "data.items[1].role"]);
        return true;
      },
    );
    const missing = safeParseApiResponse(schema, {}, "GET /items");
    assert.ok(!missing.ok);
    assert.ok(missing.error.issues.some((i) => i.path === "success"));
    assert.equal(safeParseApiResponse(schema, null, "GET /items").ok, false);
  });

  it("never puts received values in messages or logs", () => {
    const secret = "sk_live_SUPERSECRET";
    const bad = { success: true, data: { items: [{ id: "ab", role: secret }], token: 123 } };
    const result = safeParseApiResponse(schema, bad, "POST /login");
    assert.ok(!result.ok);
    const logs: Array<{ message: string; fields?: Record<string, unknown> }> = [];
    logApiValidationFailure(result.error, { warn: (message, fields) => logs.push({ message, fields }) });
    for (const text of [result.error.message, JSON.stringify(result.error.issues), JSON.stringify(logs)]) {
      assert.ok(!text.includes(secret), text);
    }
    assert.equal(logs[0].message, "api.response.validation_failed");
    assert.equal(logs[0].fields?.endpoint, "POST /login");
  });

  it("describes issues by expectation only", () => {
    const result = safeParseApiResponse(z.object({ n: z.number().min(5) }), { n: 1 }, "GET /n");
    assert.ok(!result.ok);
    assert.equal(result.error.issues[0].message, "below the minimum of 5");
  });
});
