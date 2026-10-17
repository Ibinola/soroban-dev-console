import assert from "node:assert/strict";
import test from "node:test";

import {
  backupFileName,
  parseBackupConfig,
  planRetention,
  sqlitePathFromUrl,
} from "./backup-policy.js";

const DAY = 86_400_000;
const NOW = Date.parse("2026-03-31T00:00:00Z");
const file = (name: string, ageDays: number) => ({ name: `backup_${name}.db`, mtimeMs: NOW - ageDays * DAY });

test("config defaults to disabled with daily backups and 7 / 30 day retention", () => {
  assert.deepEqual(parseBackupConfig({}), {
    enabled: false,
    intervalMinutes: 1440,
    dir: ".backups",
    retainCount: 7,
    retainDays: 30,
  });
});

test("config reads and validates environment overrides", () => {
  const c = parseBackupConfig({
    BACKUP_ENABLED: "true",
    BACKUP_INTERVAL_MINUTES: "60",
    BACKUP_DIR: "/var/backups",
    BACKUP_RETAIN_COUNT: "3",
    BACKUP_RETAIN_DAYS: "0",
  });
  assert.deepEqual(c, { enabled: true, intervalMinutes: 60, dir: "/var/backups", retainCount: 3, retainDays: 0 });
  assert.equal(parseBackupConfig({ BACKUP_INTERVAL_MINUTES: "-5" }).intervalMinutes, 1440);
  assert.equal(parseBackupConfig({ BACKUP_INTERVAL_MINUTES: "abc" }).intervalMinutes, 1440);
});

test("file names are sortable ISO-ish stamps", () => {
  assert.equal(backupFileName(new Date("2026-03-31T12:34:56.789Z")), "backup_20260331T123456Z.db");
});

test("old backups are removed but the newest N are always kept", () => {
  const files = [file("a", 1), file("b", 40), file("c", 50), file("d", 60)];
  const plan = planRetention(files, { retainCount: 2, retainDays: 30 }, NOW);
  assert.deepEqual(plan.keep, ["backup_a.db", "backup_b.db"]);
  assert.deepEqual(plan.remove, ["backup_c.db", "backup_d.db"]);
});

test("recent backups beyond the minimum count are kept", () => {
  const files = [file("a", 1), file("b", 2), file("c", 3)];
  const plan = planRetention(files, { retainCount: 1, retainDays: 30 }, NOW);
  assert.deepEqual(plan.remove, []);
});

test("with no age limit the count is a hard cap", () => {
  const files = [file("a", 1), file("b", 2), file("c", 3)];
  const plan = planRetention(files, { retainCount: 2, retainDays: 0 }, NOW);
  assert.deepEqual(plan.remove, ["backup_c.db"]);
});

test("with both limits at zero nothing is removed and foreign files are ignored", () => {
  const files = [file("a", 400), { name: "notes.txt", mtimeMs: 0 }];
  const plan = planRetention(files, { retainCount: 0, retainDays: 0 }, NOW);
  assert.deepEqual(plan, { keep: ["backup_a.db"], remove: [] });
});

test("sqlite path is resolved from a file: URL", () => {
  assert.equal(sqlitePathFromUrl("file:./dev.db", "/app/prisma"), "/app/prisma/dev.db");
  assert.equal(sqlitePathFromUrl("file:/data/app.db?x=1", "/app"), "/data/app.db");
  assert.equal(sqlitePathFromUrl("postgres://x", "/app"), null);
  assert.equal(sqlitePathFromUrl(undefined, "/app"), null);
});
