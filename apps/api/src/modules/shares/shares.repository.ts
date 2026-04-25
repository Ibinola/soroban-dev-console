import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { Prisma } from "@prisma/client";

@Injectable()
export class SharesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany<T extends Prisma.ShareLinkFindManyArgs>(
    params: Prisma.SelectSubset<T, Prisma.ShareLinkFindManyArgs>,
  ) {
    return this.prisma.shareLink.findMany(params);
  }

  async count<T extends Prisma.ShareLinkCountArgs>(
    params: Prisma.SelectSubset<T, Prisma.ShareLinkCountArgs>,
  ) {
    return this.prisma.shareLink.count(params);
  }

  async findUnique<T extends Prisma.ShareLinkFindUniqueArgs>(
    params: Prisma.SelectSubset<T, Prisma.ShareLinkFindUniqueArgs>,
  ) {
    return this.prisma.shareLink.findUnique(params);
  }

  async create<T extends Prisma.ShareLinkCreateArgs>(
    params: Prisma.SelectSubset<T, Prisma.ShareLinkCreateArgs>,
  ) {
    return this.prisma.shareLink.create(params);
  }

  async update<T extends Prisma.ShareLinkUpdateArgs>(
    params: Prisma.SelectSubset<T, Prisma.ShareLinkUpdateArgs>,
  ) {
    return this.prisma.shareLink.update(params);
  }

  async delete<T extends Prisma.ShareLinkDeleteArgs>(
    params: Prisma.SelectSubset<T, Prisma.ShareLinkDeleteArgs>,
  ) {
    return this.prisma.shareLink.delete(params);
  }

  /** BE-010: Delete all expired or revoked share records. Returns count of deleted rows. */
  async deleteExpiredAndRevoked(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.shareLink.deleteMany({
      where: {
        OR: [
          { revokedAt: { not: null } },
          { expiresAt: { lt: now } },
        ],
      },
    });
    return result.count;
  }
}
