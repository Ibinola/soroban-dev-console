import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DOCKER_PORTS,
  REQUIRED_SERVER_KEYS,
  REQUIRED_RPC_KEYS,
  parseEnv,
  isValidHttpUrl,
  collectEnvDiagnostics,
  envChecksToSetupChecks,
  checkPorts,
  scanSqliteVolumes,
  formatChecks,
} from "./validate-docker-setup.js";

describe("parseEnv", () => {
  it("parses key/value pairs and ignores comments and blanks", () => {
    const vars = parseEnv(
      [
        "# comment",
        "DATABASE_URL=file:./dev.db",
        "",
        "KEY_WITH_SPACES  =  value here ",
        "NO_EQUALS_LINE",
      ].join("\n"),
    );
    assert.equal(vars["DATABASE_URL"], "file:./dev.db");
    assert.equal(vars["KEY_WITH_SPACES"], "value here");
    assert.equal("NO_EQUALS_LINE" in vars, false);
  });

  it("returns an empty object for an empty file", () => {
    assert.deepEqual(parseEnv(""), {});
  });
});

describe("isValidHttpUrl", () => {
  it("accepts absolute http(s) URLs", () => {
    assert.equal(isValidHttpUrl("https://soroban-testnet.stellar.org:443"), true);
    assert.equal(isValidHttpUrl("http://localhost:8000/soroban/rpc"), true);
  });

  it("rejects relative paths and non-http protocols", () => {
    assert.equal(isValidHttpUrl("localhost:8000"), false);
    assert.equal(isValidHttpUrl("/soroban/rpc"), false);
    assert.equal(isValidHttpUrl("file:./dev.db"), false);
    assert.equal(isValidHttpUrl(""), false);
  });
});

describe("collectEnvDiagnostics", () => {
  it("flags missing server vars and invalid RPC URLs", () => {
    const env = { DATABASE_URL: "file:./dev.db", WEB_ORIGIN: "http://localhost:3000", PORT: "4000" };
    const diagnostics = collectEnvDiagnostics(env, REQUIRED_SERVER_KEYS, REQUIRED_RPC_KEYS);
    const byKey = Object.fromEntries(diagnostics.map((d) => [d.key, d]));

    assert.deepEqual(byKey["DATABASE_URL"], { key: "DATABASE_URL", present: true });
    assert.deepEqual(byKey["RPC_ENDPOINTS_TESTNET"], {
      key: "RPC_ENDPOINTS_TESTNET",
      present: false,
      validUrl: false,
    });
  });

  it("marks RPC keys valid when they are real http(s) endpoints", () => {
    const env = {
      RPC_ENDPOINTS_TESTNET: "https://soroban-testnet.stellar.org:443",
      RPC_ENDPOINTS_FUTURENET: "https://rpc-futurenet.stellar.org:443",
      RPC_ENDPOINTS_LOCAL: "http://localhost:8000/soroban/rpc",
    };
    const diagnostics = collectEnvDiagnostics(env, REQUIRED_SERVER_KEYS, REQUIRED_RPC_KEYS);
    const rpc = diagnostics.filter((d) => d.key.startsWith("RPC_"));
    assert.equal(rpc.length, 3);
    assert.ok(rpc.every((d) => d.present && d.validUrl));
  });

  it("reports invalid RPC URLs as present-but-invalid", () => {
    const env = { RPC_ENDPOINTS_TESTNET: "not-a-url" };
    const diagnostics = collectEnvDiagnostics(env, [], ["RPC_ENDPOINTS_TESTNET"]);
    assert.deepEqual(diagnostics, [
      { key: "RPC_ENDPOINTS_TESTNET", present: true, validUrl: false },
    ]);
  });
});

describe("envChecksToSetupChecks", () => {
  it("converts missing/invalid diagnostics into failing checks", () => {
    const checks = envChecksToSetupChecks([
      { key: "DATABASE_URL", present: false },
      { key: "RPC_ENDPOINTS_TESTNET", present: true, validUrl: false },
      { key: "PORT", present: true },
    ]);
    const statuses = Object.fromEntries(checks.map((c) => [c.message.startsWith("Missing") ? "missing" : "ok", c.status]));
    assert.equal(statuses.missing, "fail");
  });
});

describe("checkPorts", () => {
  it("maps probe results to setup checks using an injected prober", async () => {
    const probe = async (port: number) => ({
      port,
      available: port === 4000 ? false : true,
    });
    const checks = await checkPorts([3000, 4000, 8000], probe);
    const byPort = Object.fromEntries(checks.map((c, i) => [DEFAULT_DOCKER_PORTS[i], c.status]));
    assert.equal(byPort[3000], "ok");
    assert.equal(byPort[4000], "fail");
    assert.equal(byPort[8000], "ok");
    assert.match(checks[1].message, /already in use/);
  });
});

describe("scanSqliteVolumes", () => {
  it("flags a compose file with a volume section but no sqlite mount", () => {
    const checks = scanSqliteVolumes(
      "services:\n  web:\n    image: x\nvolumes:\n  web_data:\n",
    );
    assert.equal(checks.length, 1);
    assert.equal(checks[0].status, "fail");
    assert.match(checks[0].message, /SQLite volume/i);
  });

  it("flags a compose file with no volumes section at all", () => {
    const checks = scanSqliteVolumes("services:\n  web:\n    image: x\n");
    assert.equal(checks[0].status, "fail");
    assert.match(checks[0].message, /no top-level 'volumes:'/i);
  });

  it("passes when a sqlite volume mount is present", () => {
    const checks = scanSqliteVolumes(
      [
        "services:",
        "  api:",
        "    environment:",
        "      DATABASE_URL: file:/app/data/soroban.db",
        "    volumes:",
        "      - ./data:/app/data",
        "volumes:",
        "  soroban-data:",
      ].join("\n"),
    );
    assert.equal(checks.length, 1);
    assert.equal(checks[0].status, "ok");
  });
});

describe("formatChecks", () => {
  it("renders a human-readable report with status tags", () => {
    const report = formatChecks([
      { category: "ports", status: "ok", message: "Port 3000 is free" },
      { category: "env", status: "fail", message: "Missing or invalid DATABASE_URL" },
    ]);
    assert.match(report, /\[OK  \] Port 3000 is free/);
    assert.match(report, /\[FAIL\] Missing or invalid DATABASE_URL/);
  });
});