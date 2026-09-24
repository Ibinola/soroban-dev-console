/**
 * Issue #1114: unit coverage for share expiration timestamp calculation,
 * matching the "1 Hour / 24 Hours / 7 Days / Never" options exposed by the
 * share modal (apps/web/components/data-management.tsx).
 */

import { BadRequestException } from "@nestjs/common";
import { SharesService } from "./shares.service.js";

const mockRepository = {
  create: jest.fn(),
};
const mockWorkspacesRepository = {
  findUnique: jest.fn(),
};
const mockEvents = { emit: jest.fn() };
const mockAudit = { log: jest.fn() };
const mockPrisma = {};

function makeService() {
  return new (SharesService as any)(
    mockRepository,
    mockWorkspacesRepository,
    mockEvents,
    mockAudit,
    mockPrisma,
  );
}

const WORKSPACE_ID = "ws-1";
const OWNER_KEY = "owner-1";

function setUpWorkspace() {
  mockWorkspacesRepository.findUnique.mockResolvedValue({
    id: WORKSPACE_ID,
    ownerKey: OWNER_KEY,
  });
  mockRepository.create.mockImplementation(({ data }: any) =>
    Promise.resolve({ id: "share-1", ...data }),
  );
}

describe("SharesService expiration calculation (issue #1114)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setUpWorkspace();
  });

  const createDto = (expiresInSeconds?: number) => ({
    workspaceId: WORKSPACE_ID,
    snapshotJson: JSON.stringify({ name: "ws" }),
    expiresInSeconds,
  });

  it.each([
    ["1 Hour", 3600],
    ["24 Hours", 24 * 3600],
    ["7 Days", 7 * 24 * 3600],
  ])("sets expiresAt %s in the future for expiresInSeconds=%i", async (_label, seconds) => {
    const before = Date.now();
    const share = await makeService().create(OWNER_KEY, createDto(seconds));
    const after = Date.now();

    expect(share.expiresAt).toBeInstanceOf(Date);
    const expiresAtMs = share.expiresAt.getTime();
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + seconds * 1000);
    expect(expiresAtMs).toBeLessThanOrEqual(after + seconds * 1000);
  });

  it("leaves expiresAt null for the 'Never' option (no expiresInSeconds sent)", async () => {
    const share = await makeService().create(OWNER_KEY, createDto(undefined));
    expect(share.expiresAt).toBeNull();
  });

  it("rejects an expiration further than 1 year out", async () => {
    const twoYearsInSeconds = 2 * 365 * 24 * 3600;
    await expect(
      makeService().create(OWNER_KEY, createDto(twoYearsInSeconds)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
