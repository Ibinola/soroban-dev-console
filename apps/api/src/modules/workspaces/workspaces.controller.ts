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

import { ApiOperation, ApiTags } from "@nestjs/swagger";
type OwnerKeyRequest = Request & { ownerKey: string };

@ApiTags("workspaces")
@Controller("workspaces")
@UseGuards(OwnerKeyGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @ApiOperation({ summary: "List" })
  @Get()
  list(@Req() req: Request, @Query() query: ListWorkspacesDto) {
    return this.workspacesService.list((req as OwnerKeyRequest).ownerKey, query);
  }

  @ApiOperation({ summary: "Search" })
  @Get("search")
  search(@Req() req: Request, @Query() query: SearchWorkspacesDto) {
    return this.workspacesService.search((req as OwnerKeyRequest).ownerKey, query);
  }

  @ApiOperation({ summary: "Get all tags" })
  @Get("tags")
  getAllTags(@Req() req: Request) {
    return this.workspacesService.getAllTags((req as OwnerKeyRequest).ownerKey);
  }

  @ApiOperation({ summary: "Get" })
  @Get(":id")
  get(@Param("id") id: string, @Req() req: Request) {
    return this.workspacesService.get(id, (req as OwnerKeyRequest).ownerKey);
  }

  @ApiOperation({ summary: "Create" })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateWorkspaceDto, @Req() req: Request) {
    return this.workspacesService.create((req as OwnerKeyRequest).ownerKey, dto);
  }

  @ApiOperation({ summary: "Update" })
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

  @ApiOperation({ summary: "Update tags" })
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

  @ApiOperation({ summary: "Remove" })
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string, @Req() req: Request) {
    await this.workspacesService.remove(id, (req as OwnerKeyRequest).ownerKey);
  }

  @ApiOperation({ summary: "Import workspace" })
  @Post("import")
  @HttpCode(HttpStatus.CREATED)
  importWorkspace(@Body() dto: ImportWorkspaceDto, @Req() req: Request) {
    return this.workspacesService.import((req as OwnerKeyRequest).ownerKey, dto);
  }

  @ApiOperation({ summary: "Export" })
  @Get(":id/export")
  export(@Param("id") id: string, @Req() req: Request) {
    return this.workspacesService.export(id, (req as OwnerKeyRequest).ownerKey);
  }

  @ApiOperation({ summary: "Export zip" })
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

  @ApiOperation({ summary: "Replay interaction" })
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

  @ApiOperation({ summary: "Diff interactions" })
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
