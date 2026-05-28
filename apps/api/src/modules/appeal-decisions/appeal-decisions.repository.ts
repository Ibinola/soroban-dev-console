import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";

@Injectable()
export class AppealDecisionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany<T extends Prisma.AppealDecisionFindManyArgs>(
    params: Prisma.SelectSubset<T, Prisma.AppealDecisionFindManyArgs>,
  ) {
    return this.prisma.appealDecision.findMany(params);
  }

  async findFirst<T extends Prisma.AppealDecisionFindFirstArgs>(
    params: Prisma.SelectSubset<T, Prisma.AppealDecisionFindFirstArgs>,
  ) {
    return this.prisma.appealDecision.findFirst(params);
  }

  async create<T extends Prisma.AppealDecisionCreateArgs>(
    params: Prisma.SelectSubset<T, Prisma.AppealDecisionCreateArgs>,
  ) {
    return this.prisma.appealDecision.create(params);
  }
}
