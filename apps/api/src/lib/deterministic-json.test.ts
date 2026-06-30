import test from "node:test";
import assert from "node:assert/strict";
import { sortJsonKeys } from "./deterministic-json.js";

test("deterministic-json (BE-321): should sort object keys alphabetically", () => {
  const input = { c: 3, a: 1, b: 2 };
  const result = sortJsonKeys(input);
  assert.deepEqual(Object.keys(result), ["a", "b", "c"]);
});

test("deterministic-json (BE-321): should handle nested objects", () => {
  const input = {
    b: { z: 1, x: 2, y: 3 },
    a: 1
  };
  const result = sortJsonKeys(input);
  assert.deepEqual(Object.keys(result), ["a", "b"]);
  assert.deepEqual(Object.keys(result.b), ["x", "y", "z"]);
});

test("deterministic-json (BE-321): should handle arrays of objects", () => {
  const input = [
    { b: 2, a: 1 },
    { d: 4, c: 3 }
  ];
  const result = sortJsonKeys(input);
  assert.deepEqual(Object.keys(result[0]), ["a", "b"]);
  assert.deepEqual(Object.keys(result[1]), ["c", "d"]);
});

test("deterministic-json (BE-321): should handle null and primitives", () => {
  assert.equal(sortJsonKeys(null), null);
  assert.equal(sortJsonKeys("string"), "string");
  assert.equal(sortJsonKeys(123), 123);
});
