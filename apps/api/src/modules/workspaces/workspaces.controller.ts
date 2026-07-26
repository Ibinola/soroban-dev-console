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
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import {
  CreateWorkspaceDto,
  ImportWorkspaceDto,
  ListWorkspacesDto,
  SearchWorkspacesDto,
  UpdateWorkspaceDto,
  UpdateWorkspaceTagsDto,
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

  @Get("search")
  search(@Req() req: Request, @Query() query: SearchWorkspacesDto) {
    return this.workspacesService.search((req as OwnerKeyRequest).ownerKey, query);
  }

  @Get("tags")
  getAllTags(@Req() req: Request) {
    return this.workspacesService.getAllTags((req as OwnerKeyRequest).ownerKey);
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

  @Patch(":id/tags")
  updateTags(
    @Param("id") id: string,
    @Body() dto: UpdateWorkspaceTagsDto,
    @Req() req: Request,
  ) {
    return this.workspacesService.updateTags(
      id,
      (req as OwnerKeyRequest).ownerKey,
      dto.tags,
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

  @Get(":id/export/zip")
  async exportZip(
    @Param("id") id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const stream = await this.workspacesService.exportZip(
      id,
      (req as OwnerKeyRequest).ownerKey,
    );
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="workspace-${id}.zip"`,
    );
    stream.pipe(res);
  }

  @Post(":id/interactions/:interactionId/replay")
  replayInteraction(
    @Param("id") id: string,
    @Param("interactionId") interactionId: string,
    @Req() req: Request,
  ) {
    return this.workspacesService.replayInteraction(
      id,
      interactionId,
      (req as OwnerKeyRequest).ownerKey,
    );
  }

  @Get(":id/interactions/:interactionId/diff")
  diffInteractions(
    @Param("id") id: string,
    @Param("interactionId") interactionId: string,
    @Query("compare") compareId: string,
    @Req() req: Request,
  ) {
    return this.workspacesService.diffInteractions(
      id,
      interactionId,
      compareId,
      (req as OwnerKeyRequest).ownerKey,
    );
  }
}
