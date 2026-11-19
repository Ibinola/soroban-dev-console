import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createMaintenanceMiddleware,
  isBlockedByMaintenance,
  parseReadOnlyPaths,
  MAINTENANCE_ERROR_CODE,
  type MaintenanceState,
} from "./maintenance-mode.js";

function run(state: MaintenanceState, method: string, url: string, extra: string[] = []) {
  let status = 0;
  let body: any;
  const headers: Record<string, string> = {};
  let nexted = false;
  const res = {
    status(code: number) {
      status = code;
      return res;
    },
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    json(b: unknown) {
      body = b;
    },
  };
  createMaintenanceMiddleware(() => state, extra)({ method, url }, res, () => {
    nexted = true;
  });
  return { status, body, headers, nexted };
}

describe("maintenance mode (#1384)", () => {
  it("returns a consistent 503 for write routes while enabled", () => {
    const r = run({ enabled: true, reason: "db upgrade", since: "2026-01-01T00:00:00Z" }, "POST", "/api/workspaces");
    assert.equal(r.status, 503);
    assert.equal(r.nexted, false);
    assert.equal(r.body.success, false);
    assert.equal(r.body.error.code, MAINTENANCE_ERROR_CODE);
    assert.match(r.body.error.message, /db upgrade/);
    assert.equal(r.body.error.path, "/api/workspaces");
    assert.equal(r.headers["Retry-After"], "60");
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      assert.equal(run({ enabled: true }, method, "/api/shares/1").status, 503);
    }
  });

  it("lets reads, health, readiness and the toggle itself through", () => {
    const on: MaintenanceState = { enabled: true };
    assert.equal(run(on, "GET", "/api/workspaces").nexted, true);
    assert.equal(run(on, "HEAD", "/api/workspaces").nexted, true);
    assert.equal(run(on, "OPTIONS", "/api/workspaces").nexted, true);
    assert.equal(run(on, "POST", "/api/health/rpc").nexted, true);
    assert.equal(run(on, "POST", "/api/ready").nexted, true);
    assert.equal(run(on, "PUT", "/api/runtime-config/maintenance").nexted, true);
  });

  it("allows configured explicitly read-only write-method routes", () => {
    const extra = parseReadOnlyPaths("/api/rpc/simulate, bad, /API/Decode/");
    assert.deepEqual(extra, ["/api/rpc/simulate", "/api/decode/"]);
    assert.equal(run({ enabled: true }, "POST", "/api/rpc/simulate", extra).nexted, true);
    assert.equal(run({ enabled: true }, "POST", "/api/rpc/simulate/batch", extra).nexted, true);
    assert.equal(run({ enabled: true }, "POST", "/api/rpc/send", extra).status, 503);
  });

  it("does nothing while disabled and reacts to a toggle without a restart", () => {
    const state: MaintenanceState = { enabled: false };
    const mw = createMaintenanceMiddleware(() => state, []);
    let blocked = 0;
    const call = () => {
      let hit = false;
      const res = { status: () => res, setHeader: () => {}, json: () => void (hit = true) } as any;
      mw({ method: "POST", url: "/api/workspaces" }, res, () => {});
      if (hit) blocked += 1;
    };
    call();
    state.enabled = true;
    call();
    state.enabled = false;
    call();
    assert.equal(blocked, 1);
  });

  it("matches paths without a query string or trailing slash and ignores look-alike prefixes", () => {
    assert.equal(isBlockedByMaintenance("POST", "/api/health?x=1"), false);
    assert.equal(isBlockedByMaintenance("POST", "/api/health/"), false);
    assert.equal(isBlockedByMaintenance("POST", "/api/healthy-writes"), true);
  });
});
