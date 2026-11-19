import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyDeprecationsToOpenApi,
  createDeprecationMiddleware,
  deprecationHeaders,
  findDeprecation,
  parseDeprecations,
} from "./api-deprecation.js";

const config = JSON.stringify([
  { method: "get", path: "/api/old/", sunset: "2027-01-01", deprecatedSince: "2026-06-01T00:00:00Z", migration: "Use /api/new.", link: "https://docs.example.com/migrate" },
  { path: "/api/legacy", sunset: "2027-03-01T12:00:00Z" },
  { path: "no-slash", sunset: "2027-01-01" },
  { path: "/api/bad-date", sunset: "soon" },
]);

function headersFor(method: string, url: string, rules = parseDeprecations(config)) {
  const headers: Record<string, string> = {};
  createDeprecationMiddleware(rules)({ method, url }, { setHeader: (n, v) => void (headers[n] = v) }, () => {});
  return headers;
}

describe("API deprecation metadata (#1379)", () => {
  it("drops invalid entries and ignores unparsable configuration", () => {
    assert.equal(parseDeprecations(config).length, 2);
    for (const bad of [undefined, "", "not json", "{}", "[1, null]"]) assert.deepEqual(parseDeprecations(bad), []);
  });

  it("emits standard Deprecation and Sunset headers for configured routes", () => {
    const h = headersFor("GET", "/api/old?x=1");
    assert.equal(h.Deprecation, `@${Math.floor(Date.parse("2026-06-01T00:00:00Z") / 1000)}`);
    assert.equal(h.Sunset, "Fri, 01 Jan 2027 00:00:00 GMT");
    assert.equal(h.Link, '<https://docs.example.com/migrate>; rel="deprecation"; type="text/html"');
  });

  it("uses Deprecation: true when no start date is configured and respects the method", () => {
    assert.equal(headersFor("POST", "/api/legacy").Deprecation, "true");
    assert.equal(headersFor("DELETE", "/api/legacy/").Sunset, "Mon, 01 Mar 2027 12:00:00 GMT");
    assert.deepEqual(headersFor("POST", "/api/old"), {}); // rule is GET-only
  });

  it("adds no new headers to routes without deprecation configuration", () => {
    assert.deepEqual(headersFor("GET", "/api/current"), {});
    assert.deepEqual(headersFor("GET", "/api/old", []), {});
    assert.equal(findDeprecation(parseDeprecations(config), "GET", "/api/older"), undefined);
  });

  it("marks the same routes deprecated in OpenAPI with migration guidance", () => {
    const rules = parseDeprecations(config);
    const doc = applyDeprecationsToOpenApi(
      {
        paths: {
          "/api/old": { get: { summary: "old", description: "Original." }, post: { summary: "p" } },
          "/api/legacy": { post: { summary: "l" } },
          "/api/current": { get: { summary: "c" } },
        },
      },
      rules,
    );
    assert.equal(doc.paths["/api/old"].get.deprecated, true);
    assert.match(doc.paths["/api/old"].get.description, /Original\.\n\nDeprecated; scheduled for removal on Fri, 01 Jan 2027/);
    assert.match(doc.paths["/api/old"].get.description, /Use \/api\/new\./);
    assert.equal(doc.paths["/api/old"].post.deprecated, undefined); // method-specific
    assert.equal(doc.paths["/api/legacy"].post.deprecated, true);
    assert.equal(doc.paths["/api/current"].get.deprecated, undefined);
  });

  it("builds headers without a Link when no link is configured", () => {
    const [rule] = parseDeprecations(JSON.stringify([{ path: "/x", sunset: "2027-01-01" }]));
    assert.deepEqual(Object.keys(deprecationHeaders(rule)).sort(), ["Deprecation", "Sunset"]);
  });
});
