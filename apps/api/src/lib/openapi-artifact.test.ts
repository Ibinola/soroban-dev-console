import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canonicalizeOpenApi, diffOpenApi, serializeOpenApi } from "./openapi-artifact.js";

const base = {
  openapi: "3.0.0",
  info: { title: "API", version: "0.1.0" },
  servers: [{ url: "http://localhost:4000" }],
  paths: { "/b": { get: { summary: "b" } }, "/a": { get: { summary: "a" } } },
};

describe("OpenAPI artifact determinism (#1380)", () => {
  it("is independent of key order and removes servers", () => {
    const reordered = { paths: { "/a": { get: { summary: "a" } }, "/b": { get: { summary: "b" } } }, info: { version: "0.1.0", title: "API" }, openapi: "3.0.0" };
    assert.equal(serializeOpenApi(base), serializeOpenApi(reordered));
    assert.equal("servers" in canonicalizeOpenApi(base), false);
    assert.ok(serializeOpenApi(base).endsWith("}\n"));
    assert.ok(serializeOpenApi(base).indexOf('"/a"') < serializeOpenApi(base).indexOf('"/b"'));
  });

  it("contains no environment-specific URLs or secrets", () => {
    const text = serializeOpenApi({
      ...base,
      info: { title: "API", version: "1", description: "See http://localhost:3000/docs, https://api.internal/x and http://127.0.0.1:8080/y; apikey=abc123 token: xyz" },
    });
    for (const leaked of ["localhost", "127.0.0.1", "api.internal", "abc123", "xyz"]) assert.ok(!text.includes(leaked), leaked);
    assert.ok(text.includes("<environment-url>"));
    assert.ok(text.includes("https://docs.example.com") === false);
  });

  it("keeps public documentation URLs", () => {
    const text = serializeOpenApi({ ...base, info: { title: "API", version: "1", description: "See https://docs.example.com/guide" } });
    assert.ok(text.includes("https://docs.example.com/guide"));
  });

  it("reports no difference for identical output", () => {
    assert.deepEqual(diffOpenApi(serializeOpenApi(base), serializeOpenApi(base)), { identical: true, lines: [] });
  });

  it("reports readable added, removed and changed entries on mismatch", () => {
    const next = {
      ...base,
      paths: { "/a": { get: { summary: "a changed" } }, "/c": { post: { summary: "new" } } },
    };
    const diff = diffOpenApi(serializeOpenApi(base), serializeOpenApi(next));
    assert.equal(diff.identical, false);
    assert.ok(diff.lines.includes('~ paths./a.get.summary: "a" -> "a changed"'));
    assert.ok(diff.lines.includes('+ paths./c.post.summary = "new"'));
    assert.ok(diff.lines.includes('- paths./b.get.summary (was "b")'));
  });

  it("flags a non-canonical committed file and invalid JSON", () => {
    const pretty = JSON.stringify(base);
    assert.match(diffOpenApi(pretty, serializeOpenApi(base)).lines[0], /not in canonical form/);
    assert.match(diffOpenApi("{oops", serializeOpenApi(base)).lines[0], /not valid JSON/);
  });

  it("caps very long reports", () => {
    const many = (n: number) => ({ ...base, paths: Object.fromEntries(Array.from({ length: n }, (_, i) => [`/p${i}`, { get: { summary: `s${i}` } }])) });
    const diff = diffOpenApi(serializeOpenApi(many(0)), serializeOpenApi(many(50)), 10);
    assert.equal(diff.lines.length, 11);
    assert.match(diff.lines[10], /more difference/);
  });
});
