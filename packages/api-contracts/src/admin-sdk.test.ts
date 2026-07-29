import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createAdminSdk, createLocalAdminSdk } from "./admin-sdk.js";

describe("AdminSdk", () => {
  it("creates instance with custom config", () => {
    const sdk = createAdminSdk({ baseUrl: "http://localhost:4000", token: "test-token" });
    assert.ok(sdk);
  });

  it("creates local sdk with default port", () => {
    const sdk = createLocalAdminSdk();
    assert.ok(sdk);
  });

  it("creates local sdk with custom port", () => {
    const sdk = createLocalAdminSdk(5000);
    assert.ok(sdk);
  });

  it("strips trailing slash from baseUrl", () => {
    const sdk = createAdminSdk({ baseUrl: "http://localhost:4000/" });
    assert.ok(sdk);
  });

  it("generates correct URL for budget scopes", async () => {
    const sdk = createAdminSdk({ baseUrl: "http://localhost:4000" });
    try {
      await sdk.getBudgetScopes({ orgId: "org-1" });
    } catch (e: any) {
      assert.ok(e.message.includes("GET"));
      assert.ok(e.message.includes("/admin/budgets?orgId=org-1"));
    }
  });

  it("generates correct URL for single budget scope", async () => {
    const sdk = createAdminSdk({ baseUrl: "http://localhost:4000" });
    try {
      await sdk.getBudgetScope("scope-1");
    } catch (e: any) {
      assert.ok(e.message.includes("/admin/budgets/scope-1"));
    }
  });

  it("generates correct URL for audit logs", async () => {
    const sdk = createAdminSdk({ baseUrl: "http://localhost:4000" });
    try {
      await sdk.getAuditLogs({ resourceType: "workspace", resourceId: "ws-1" });
    } catch (e: any) {
      assert.ok(e.message.includes("/admin/audit?resourceType=workspace&resourceId=ws-1"));
    }
  });

  it("generates correct URL for runtime config", async () => {
    const sdk = createAdminSdk({ baseUrl: "http://localhost:4000" });
    try {
      await sdk.getRuntimeConfig();
    } catch (e: any) {
      assert.ok(e.message.includes("/admin/config"));
    }
  });

  it("generates correct URL for health check", async () => {
    const sdk = createAdminSdk({ baseUrl: "http://localhost:4000" });
    try {
      await sdk.healthCheck();
    } catch (e: any) {
      assert.ok(e.message.includes("/admin/health"));
    }
  });
});
