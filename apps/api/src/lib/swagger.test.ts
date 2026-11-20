import assert from "node:assert/strict";
import test from "node:test";

import { isSwaggerEnabled } from "./swagger.js";

test("swagger is on in development and off in production by default", () => {
  assert.equal(isSwaggerEnabled({ NODE_ENV: "development" }), true);
  assert.equal(isSwaggerEnabled({}), true);
  assert.equal(isSwaggerEnabled({ NODE_ENV: "production" }), false);
});

test("SWAGGER_ENABLED overrides the environment default", () => {
  assert.equal(isSwaggerEnabled({ NODE_ENV: "production", SWAGGER_ENABLED: "true" }), true);
  assert.equal(isSwaggerEnabled({ NODE_ENV: "development", SWAGGER_ENABLED: "false" }), false);
});
