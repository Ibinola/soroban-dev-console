import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";

@Injectable()
export class ContributorVerificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany<T extends Prisma.ContributorVerificationFindManyArgs>(
    params: Prisma.SelectSubset<T, Prisma.ContributorVerificationFindManyArgs>,
  ) {
    return this.prisma.contributorVerification.findMany(params);
  }

  async findFirst<T extends Prisma.ContributorVerificationFindFirstArgs>(
    params: Prisma.SelectSubset<T, Prisma.ContributorVerificationFindFirstArgs>,
  ) {
    return this.prisma.contributorVerification.findFirst(params);
  }

  async upsert<T extends Prisma.ContributorVerificationUpsertArgs>(
    params: Prisma.SelectSubset<T, Prisma.ContributorVerificationUpsertArgs>,
  ) {
    return this.prisma.contributorVerification.upsert(params);
  }

  async update<T extends Prisma.ContributorVerificationUpdateArgs>(
    params: Prisma.SelectSubset<T, Prisma.ContributorVerificationUpdateArgs>,
  ) {
    return this.prisma.contributorVerification.update(params);
  }
}
