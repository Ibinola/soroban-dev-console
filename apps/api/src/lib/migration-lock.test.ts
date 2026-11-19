import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MigrationStartupError,
  assertSchemaStateCertain,
  classifyMigrationError,
  findUncertainMigrations,
  redactConnectionDetails,
  resolveMigrationLockTimeoutMs,
} from "./migration-lock.js";

const rows = (...items: Array<[string, string | null, string | null]>) =>
  items.map(([migration_name, finished_at, rolled_back_at]) => ({ migration_name, finished_at, rolled_back_at }));

describe("migration lock timeout reporting (#1383)", () => {
  it("lock timeout errors name the phase and the configured timeout", () => {
    const err = classifyMigrationError(
      new Error("Timed out trying to acquire a postgres advisory lock (SELECT pg_advisory_lock(72707369)). Timeout: 10000ms"),
      "lock-acquisition",
      10_000,
    );
    assert.equal(err.kind, "LOCK_TIMEOUT");
    assert.equal(err.phase, "lock-acquisition");
    assert.equal(err.timeoutMs, 10_000);
    assert.match(err.message, /lock-acquisition/);
    assert.match(err.message, /10000ms/);
  });

  it("recognizes SQLite and Prisma lock errors but keeps connection failures distinct", () => {
    for (const msg of ["database is locked", "SQLITE_BUSY: database table is locked", "P1002 The database server was reached but timed out"]) {
      assert.equal(classifyMigrationError(new Error(msg), "schema-check", 5000).kind, "LOCK_TIMEOUT", msg);
    }
    for (const msg of ["connect ECONNREFUSED 127.0.0.1:5432", "Can't reach database server at host:5432", "P1001"]) {
      assert.equal(classifyMigrationError(new Error(msg), "schema-check", 5000).kind, "CONNECTION", msg);
    }
    assert.equal(classifyMigrationError(new Error("something else"), "schema-check", 5000).kind, "UNKNOWN");
    assert.equal(classifyMigrationError("not an error object", "schema-check", 1).kind, "UNKNOWN");
  });

  it("never includes credentials or full connection strings", () => {
    const secret = "postgresql://admin:hunter2@db.internal:5432/app?sslmode=require";
    const err = classifyMigrationError(new Error(`Can't reach database server at ${secret} password=hunter2 file:./data/prod.db`), "schema-check", 1000);
    for (const leaked of ["hunter2", "admin", "db.internal", "postgresql://", "prod.db"]) {
      assert.ok(!err.message.includes(leaked), `${leaked} leaked: ${err.message}`);
    }
    assert.equal(redactConnectionDetails("token=abc mysql://u:p@h/db"), "token=[redacted] [redacted-connection]");
  });

  it("finds started-but-unfinished migrations", () => {
    const found = findUncertainMigrations(rows(["001_init", "2026-01-01", null], ["003_new", null, null], ["002_mid", null, null], ["004_undone", null, "2026-02-01"]));
    assert.deepEqual(found, ["002_mid", "003_new"]);
  });

  it("does not continue startup while schema state is uncertain", async () => {
    await assert.rejects(
      () => assertSchemaStateCertain({ readMigrationRows: async () => rows(["005_half", null, null]) }),
      (e: unknown) => e instanceof MigrationStartupError && e.kind === "UNCERTAIN_SCHEMA_STATE" && /005_half/.test(e.message),
    );
  });

  it("passes for a clean or absent migrations table", async () => {
    await assertSchemaStateCertain({ readMigrationRows: async () => rows(["001", "2026-01-01", null]) });
    await assertSchemaStateCertain({ readMigrationRows: async () => null });
  });

  it("reports a lock timeout when the check does not finish in time", async () => {
    await assert.rejects(
      () => assertSchemaStateCertain({ readMigrationRows: () => new Promise(() => {}) }, { timeoutMs: 20, phase: "schema-check" }),
      (e: unknown) => e instanceof MigrationStartupError && e.kind === "LOCK_TIMEOUT" && e.timeoutMs === 20 && e.phase === "schema-check",
    );
  });

  it("classifies a reader that throws a lock error", async () => {
    await assert.rejects(
      () => assertSchemaStateCertain({ readMigrationRows: async () => { throw new Error("database is locked"); } }, { timeoutMs: 50 }),
      (e: unknown) => e instanceof MigrationStartupError && e.kind === "LOCK_TIMEOUT",
    );
  });

  it("resolves the timeout from the environment with a safe default", () => {
    assert.equal(resolveMigrationLockTimeoutMs({ MIGRATION_LOCK_TIMEOUT_MS: "2500" }), 2500);
    for (const bad of [undefined, "", "abc", "0", "-5"]) {
      assert.equal(resolveMigrationLockTimeoutMs({ MIGRATION_LOCK_TIMEOUT_MS: bad }), 10_000);
    }
  });
});
