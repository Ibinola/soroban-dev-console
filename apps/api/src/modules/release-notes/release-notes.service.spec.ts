/**
 * AI-924: Regression coverage for ReleaseNotesService.
 */

import { ReleaseNotesService, RELEASE_NOTES_MODEL_VERSION } from "./release-notes.service.js";

function makeDeps(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[][]> = { upsert: [] };
  const prisma = {
    releaseNotesDraft: {
      upsert: async (a: unknown) => { calls.upsert.push([a]); return overrides.upsertResult ?? { id: "id-1", releaseId: "r-1" }; },
      findUnique: async () => overrides.findUniqueResult,
      findMany: async () => [],
    },
  } as any;
  const audit = { log: () => {} } as any;
  return { prisma, audit, calls };
}

describe("ReleaseNotesService", () => {
  it("sections feat-prefixed PRs as New Features", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new ReleaseNotesService(prisma, audit);
    await svc.draft({
      releaseId: "r-1", version: "1.1.0",
      mergedEntries: [{ prNumber: 100, title: "feat: add new module", author: "alice" }],
    }, "actor");
    const createArg = (calls.upsert[0][0] as any).create;
    const sections = createArg.sections as any[];
    expect(sections[0].heading).toBe("New Features");
    expect(createArg.modelVersion).toBe(RELEASE_NOTES_MODEL_VERSION);
  });

  it("sections fix-prefixed PRs as Bug Fixes", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new ReleaseNotesService(prisma, audit);
    await svc.draft({
      releaseId: "r-2", version: "1.0.1",
      mergedEntries: [{ prNumber: 101, title: "fix: resolve null pointer", author: "bob" }],
    }, "actor");
    const createArg = (calls.upsert[0][0] as any).create;
    expect(createArg.sections[0].heading).toBe("Bug Fixes");
  });

  it("groups multiple entries in the same section", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new ReleaseNotesService(prisma, audit);
    await svc.draft({
      releaseId: "r-3", version: "2.0.0",
      mergedEntries: [
        { prNumber: 1, title: "feat: feature A", author: "a" },
        { prNumber: 2, title: "feat: feature B", author: "b" },
      ],
    }, "actor");
    const sections = (calls.upsert[0][0] as any).create.sections as any[];
    expect(sections[0].entries.length).toBe(2);
  });

  it("notesText includes version header", async () => {
    const { prisma, audit, calls } = makeDeps();
    const svc = new ReleaseNotesService(prisma, audit);
    await svc.draft({
      releaseId: "r-4", version: "3.0.0",
      mergedEntries: [{ prNumber: 10, title: "chore: cleanup", author: "x" }],
    }, "actor");
    const createArg = (calls.upsert[0][0] as any).create;
    expect(createArg.notesText).toContain("## 3.0.0");
  });

  it("getByRelease throws when not found", async () => {
    const { prisma, audit } = makeDeps({ findUniqueResult: null });
    const svc = new ReleaseNotesService(prisma, audit);
    let threw = false;
    try { await svc.getByRelease("missing"); } catch { threw = true; }
    expect(threw).toBe(true);
  });
});
