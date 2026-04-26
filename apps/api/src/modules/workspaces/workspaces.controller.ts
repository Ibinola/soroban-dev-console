import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import {
  CreateWorkspaceDto,
  ImportWorkspaceDto,
  ListWorkspacesDto,
  UpdateWorkspaceDto,
} from "./workspace.dto.js";
import { WorkspacesService } from "./workspaces.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("workspaces")
@UseGuards(OwnerKeyGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  list(@Req() req: Request, @Query() query: ListWorkspacesDto) {
    return this.workspacesService.list((req as OwnerKeyRequest).ownerKey, query);
  }

  @Get(":id")
  get(@Param("id") id: string, @Req() req: Request) {
    return this.workspacesService.get(id, (req as OwnerKeyRequest).ownerKey);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateWorkspaceDto, @Req() req: Request) {
    return this.workspacesService.create((req as OwnerKeyRequest).ownerKey, dto);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateWorkspaceDto,
    @Req() req: Request,
  ) {
    return this.workspacesService.update(
      id,
      (req as OwnerKeyRequest).ownerKey,
      dto,
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string, @Req() req: Request) {
    await this.workspacesService.remove(id, (req as OwnerKeyRequest).ownerKey);
  }

  @Post("import")
  @HttpCode(HttpStatus.CREATED)
  importWorkspace(@Body() dto: ImportWorkspaceDto, @Req() req: Request) {
    return this.workspacesService.import((req as OwnerKeyRequest).ownerKey, dto);
  }

  @Get(":id/export")
  export(@Param("id") id: string, @Req() req: Request) {
    return this.workspacesService.export(id, (req as OwnerKeyRequest).ownerKey);
  }
}
