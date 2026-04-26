/**
 * BE-022: API coverage for share expiry, revocation, and public resolution edge cases.
 */

import { NotFoundException, ForbiddenException, GoneException } from "@nestjs/common";
import { SharesService } from "./shares.service.js";

const mockRepo = {
  findByToken: jest.fn(),
  revoke: jest.fn(),
};

const mockWorkspacesRepo = { findById: jest.fn() };
const mockEvents = { emit: jest.fn() };
const mockAudit = { log: jest.fn() };

function makeService() {
  return new (SharesService as any)(mockRepo, mockWorkspacesRepo, mockEvents, mockAudit);
}

describe("shares edge cases (BE-022)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws GoneException for expired share", async () => {
    mockRepo.findByToken.mockResolvedValue({
      id: "s1", revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(makeService().resolvePublic("tok")).rejects.toBeInstanceOf(GoneException);
  });

  it("throws GoneException for revoked share", async () => {
    mockRepo.findByToken.mockResolvedValue({
      id: "s2", revokedAt: new Date(), expiresAt: null,
    });
    await expect(makeService().resolvePublic("tok")).rejects.toBeInstanceOf(GoneException);
  });

  it("throws NotFoundException for missing share token", async () => {
    mockRepo.findByToken.mockResolvedValue(null);
    await expect(makeService().resolvePublic("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws ForbiddenException when revoking share with wrong owner key", async () => {
    mockRepo.findByToken.mockResolvedValue({ id: "s3", ownerKey: "correct-key" });
    await expect(makeService().revoke("s3", "wrong-key")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("distinguishes not-found from revoked in resolution", async () => {
    mockRepo.findByToken.mockResolvedValueOnce(null);
    const notFound = makeService().resolvePublic("x").catch((e: Error) => e.constructor.name);

    mockRepo.findByToken.mockResolvedValueOnce({ id: "s4", revokedAt: new Date(), expiresAt: null });
    const revoked = makeService().resolvePublic("x").catch((e: Error) => e.constructor.name);

    expect(await notFound).toBe("NotFoundException");
    expect(await revoked).toBe("GoneException");
  });
});
