import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { prisma } from "../../lib/prisma.js";
import { CreateWorkspaceDto, UpdateWorkspaceDto } from "./workspace.dto.js";

@Injectable()
export class WorkspacesService {
  async list() {
    return prisma.workspace.findMany({ orderBy: { createdAt: "desc" } });
  }

  async findById(id: string) {
    const workspace = await prisma.workspace.findUnique({ where: { id } });
    if (!workspace) throw new NotFoundException(`Workspace ${id} not found`);
    return workspace;
  }

  async create(dto: CreateWorkspaceDto) {
    if (!dto.name?.trim()) throw new BadRequestException("name is required");
    return prisma.workspace.create({ data: { name: dto.name.trim() } });
  }

  async update(id: string, dto: UpdateWorkspaceDto) {
    await this.findById(id);
    if (dto.name !== undefined && !dto.name.trim())
      throw new BadRequestException("name must not be empty");
    return prisma.workspace.update({
      where: { id },
      data: { ...(dto.name !== undefined && { name: dto.name.trim() }) },
    });
  }
}
