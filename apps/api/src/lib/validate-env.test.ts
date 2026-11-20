import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeEnv,
  formatEnvDiagnosticsTable,
  isValidDatabaseUrl,
  isValidHttpUrl,
} from "./validate-env.js";

describe("isValidDatabaseUrl", () => {
  it("accepts sqlite file paths and postgres URLs", () => {
    assert.equal(isValidDatabaseUrl("file:./dev.db"), true);
    assert.equal(isValidDatabaseUrl("file:/app/data/soroban.sqlite"), true);
    assert.equal(isValidDatabaseUrl("postgres://user:pass@localhost:5432/console"), true);
    assert.equal(isValidDatabaseUrl("postgresql://user@host/db"), true);
  });

  it("rejects malformed database URLs", () => {
    assert.equal(isValidDatabaseUrl("mariadb://host/db"), false);
    assert.equal(isValidDatabaseUrl("sqlite:dev"), false);
    assert.equal(isValidDatabaseUrl(""), false);
    assert.equal(isValidDatabaseUrl(undefined), false);
  });
});

describe("isValidHttpUrl", () => {
  it("accepts absolute http(s) URLs", () => {
    assert.equal(isValidHttpUrl("https://soroban-testnet.stellar.org:443"), true);
    assert.equal(isValidHttpUrl("http://localhost:8000/soroban/rpc"), true);
  });

  it("rejects relative, bare, and non-http values", () => {
    assert.equal(isValidHttpUrl("localhost:8000/soroban/rpc"), false);
    assert.equal(isValidHttpUrl("/soroban/rpc"), false);
    assert.equal(isValidHttpUrl("file:./dev.db"), false);
    assert.equal(isValidHttpUrl(""), false);
  });
});

describe("analyzeEnv", () => {
  const happyEnv = {
    DATABASE_URL: "file:./dev.db",
    WEB_ORIGIN: "http://localhost:3000",
    PORT: "4000",
    RPC_ENDPOINTS_TESTNET: "https://soroban-testnet.stellar.org:443",
    RPC_ENDPOINTS_FUTURENET: "https://rpc-futurenet.stellar.org:443",
    RPC_ENDPOINTS_LOCAL: "http://localhost:8000/soroban/rpc",
  };

  it("reports no failures for a complete, well-formed environment", () => {
    assert.deepEqual(analyzeEnv(happyEnv), []);
  });

  it("flags missing server env as missing", () => {
    const diagnostics = analyzeEnv({ WEB_ORIGIN: "http://localhost:3000", PORT: "4000" });
    assert.equal(diagnostics.length, 1);
    assert.deepEqual(diagnostics[0], {
      variable: "DATABASE_URL",
      boundary: "server",
      status: "missing",
      message: "is required",
    });
  });

  it("flags malformed DATABASE_URL as invalid", () => {
    const diagnostics = analyzeEnv({ ...happyEnv, DATABASE_URL: "mysql://db" });
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].variable, "DATABASE_URL");
    assert.equal(diagnostics[0].status, "invalid");
    assert.match(diagnostics[0].message ?? "", /sqlite file path or a postgres/);
  });

  it("flags present-but-invalid RPC endpoint URLs", () => {
    const diagnostics = analyzeEnv({ ...happyEnv, RPC_ENDPOINTS_TESTNET: "soroban-testnet.stellar.org" });
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].variable, "RPC_ENDPOINTS_TESTNET");
    assert.equal(diagnostics[0].status, "invalid");
  });

  it("does not flag absent optional RPC vars", () => {
    const diagnostics = analyzeEnv({ DATABASE_URL: "file:./dev.db", WEB_ORIGIN: "o", PORT: "1" });
    assert.deepEqual(diagnostics, []);
  });

  it("validates the SOROBAN_RPC_TESTNET_URL alias only when set", () => {
    const good = analyzeEnv({ ...happyEnv, SOROBAN_RPC_TESTNET_URL: "https://soroban-testnet.stellar.org:443" });
    assert.deepEqual(good, []);

    const bad = analyzeEnv({ ...happyEnv, SOROBAN_RPC_TESTNET_URL: "not-a-url" });
    assert.equal(bad.length, 1);
    assert.equal(bad[0].variable, "SOROBAN_RPC_TESTNET_URL");
    assert.equal(bad[0].status, "invalid");
  });
});

describe("formatEnvDiagnosticsTable", () => {
  it("renders a readable ASCII table with the failures", () => {
    const table = formatEnvDiagnosticsTable([
      { variable: "DATABASE_URL", boundary: "server", status: "missing", message: "is required" },
      { variable: "RPC_ENDPOINTS_TESTNET", boundary: "rpc", status: "invalid", message: "must be an absolute http(s) URL" },
    ]);
    assert.match(table, /Variable/);
    assert.match(table, /Status/);
    assert.match(table, /DATABASE_URL/);
    assert.match(table, /is required/);
    assert.match(table, /RPC_ENDPOINTS_TESTNET/);
    assert.match(table, /must be an absolute http\(s\) URL/);
  });
});