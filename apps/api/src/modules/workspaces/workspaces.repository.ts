import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { Prisma } from "@prisma/client";

@Injectable()
export class WorkspacesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany<T extends Prisma.WorkspaceFindManyArgs>(
    params: Prisma.SelectSubset<T, Prisma.WorkspaceFindManyArgs>,
  ) {
    return this.prisma.workspace.findMany(params);
  }

  async count<T extends Prisma.WorkspaceCountArgs>(
    params: Prisma.SelectSubset<T, Prisma.WorkspaceCountArgs>,
  ) {
    return this.prisma.workspace.count(params);
  }

  async findFirst<T extends Prisma.WorkspaceFindFirstArgs>(
    params: Prisma.SelectSubset<T, Prisma.WorkspaceFindFirstArgs>,
  ) {
    return this.prisma.workspace.findFirst(params);
  }

  async findUnique<T extends Prisma.WorkspaceFindUniqueArgs>(
    params: Prisma.SelectSubset<T, Prisma.WorkspaceFindUniqueArgs>,
  ) {
    return this.prisma.workspace.findUnique(params);
  }

  async create<T extends Prisma.WorkspaceCreateArgs>(
    params: Prisma.SelectSubset<T, Prisma.WorkspaceCreateArgs>,
  ) {
    return this.prisma.workspace.create(params);
  }

  async update<T extends Prisma.WorkspaceUpdateArgs>(
    params: Prisma.SelectSubset<T, Prisma.WorkspaceUpdateArgs>,
  ) {
    return this.prisma.workspace.update(params);
  }

  async delete<T extends Prisma.WorkspaceDeleteArgs>(
    params: Prisma.SelectSubset<T, Prisma.WorkspaceDeleteArgs>,
  ) {
    return this.prisma.workspace.delete(params);
  }
}
