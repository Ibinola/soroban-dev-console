import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
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
  WorkspaceExportDto,
} from "./workspace.dto.js";
import { WorkspacesService } from "./workspaces.service.js";
import { WorkspaceIdempotencyService } from "./workspace-idempotency.service.js";

import { ApiOperation, ApiTags } from "@nestjs/swagger";
type OwnerKeyRequest = Request & { ownerKey: string };

@ApiTags("workspaces")
@Controller("workspaces")
@UseGuards(OwnerKeyGuard)
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly idempotency: WorkspaceIdempotencyService,
  ) {}

  private getIdempotencyKey(
    header: string | string[] | undefined,
  ): string | undefined {
    if (Array.isArray(header)) return header[0]?.trim() || undefined;
    const value = header?.trim();
    return value ? value : undefined;
  }

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
  async create(
    @Body() dto: CreateWorkspaceDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers("idempotency-key") idempotencyHeader?: string | string[],
  ) {
    const ownerKey = (req as OwnerKeyRequest).ownerKey;
    const idemKey = this.getIdempotencyKey(idempotencyHeader);
    if (idemKey) {
      const cacheKey = this.idempotency.makeKey(
        ownerKey,
        idemKey,
        req.method,
        req.originalUrl?.split("?")[0] ?? req.url,
        dto,
      );
      const cached = this.idempotency.get(cacheKey);
      if (cached) {
        res.status(cached.status);
        return cached.body;
      }
      const created = await this.workspacesService.create(ownerKey, dto);
      this.idempotency.set(cacheKey, HttpStatus.CREATED, created);
      return created;
    }
    return this.workspacesService.create(ownerKey, dto);
  }

  @ApiOperation({ summary: "Update" })
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateWorkspaceDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers("idempotency-key") idempotencyHeader?: string | string[],
  ) {
    const ownerKey = (req as OwnerKeyRequest).ownerKey;
    const idemKey = this.getIdempotencyKey(idempotencyHeader);
    if (idemKey) {
      const cacheKey = this.idempotency.makeKey(
        ownerKey,
        idemKey,
        req.method,
        req.originalUrl?.split("?")[0] ?? req.url,
        { id, dto },
      );
      const cached = this.idempotency.get(cacheKey);
      if (cached) {
        res.status(cached.status);
        return cached.body;
      }
      const updated = await this.workspacesService.update(id, ownerKey, dto);
      this.idempotency.set(cacheKey, HttpStatus.OK, updated);
      return updated;
    }
    return this.workspacesService.update(id, ownerKey, dto);
  }

  @ApiOperation({ summary: "Update (PUT)" })
  @Put(":id")
  async updatePut(
    @Param("id") id: string,
    @Body() dto: UpdateWorkspaceDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers("idempotency-key") idempotencyHeader?: string | string[],
  ) {
    const ownerKey = (req as OwnerKeyRequest).ownerKey;
    const idemKey = this.getIdempotencyKey(idempotencyHeader);
    if (idemKey) {
      const cacheKey = this.idempotency.makeKey(
        ownerKey,
        idemKey,
        req.method,
        req.originalUrl?.split("?")[0] ?? req.url,
        { id, dto },
      );
      const cached = this.idempotency.get(cacheKey);
      if (cached) {
        res.status(cached.status);
        return cached.body;
      }
      const updated = await this.workspacesService.update(id, ownerKey, dto);
      this.idempotency.set(cacheKey, HttpStatus.OK, updated);
      return updated;
    }
    return this.workspacesService.update(id, ownerKey, dto);
  }

  @ApiOperation({ summary: "Update tags" })
  @Patch(":id/tags")
  async updateTags(
    @Param("id") id: string,
    @Body() dto: UpdateWorkspaceTagsDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers("idempotency-key") idempotencyHeader?: string | string[],
  ) {
    const ownerKey = (req as OwnerKeyRequest).ownerKey;
    const idemKey = this.getIdempotencyKey(idempotencyHeader);
    if (idemKey) {
      const cacheKey = this.idempotency.makeKey(
        ownerKey,
        idemKey,
        req.method,
        req.originalUrl?.split("?")[0] ?? req.url,
        { id, dto },
      );
      const cached = this.idempotency.get(cacheKey);
      if (cached) {
        res.status(cached.status);
        return cached.body;
      }
      const updated = await this.workspacesService.updateTags(id, ownerKey, dto.tags);
      this.idempotency.set(cacheKey, HttpStatus.OK, updated);
      return updated;
    }
    return this.workspacesService.updateTags(id, ownerKey, dto.tags);
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
  async importWorkspace(
    @Body() dto: ImportWorkspaceDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers("idempotency-key") idempotencyHeader?: string | string[],
  ) {
    const ownerKey = (req as OwnerKeyRequest).ownerKey;
    const idemKey = this.getIdempotencyKey(idempotencyHeader);
    if (idemKey) {
      const cacheKey = this.idempotency.makeKey(
        ownerKey,
        idemKey,
        req.method,
        req.originalUrl?.split("?")[0] ?? req.url,
        dto,
      );
      const cached = this.idempotency.get(cacheKey);
      if (cached) {
        res.status(cached.status);
        return cached.body;
      }
      const imported = await this.workspacesService.import(ownerKey, dto);
      this.idempotency.set(cacheKey, HttpStatus.CREATED, imported);
      return imported;
    }
    return this.workspacesService.import(ownerKey, dto);
  }

  @ApiOperation({ summary: "Export" })
  @Get(":id/export")
  export(@Param("id") id: string, @Req() req: Request): Promise<WorkspaceExportDto> {
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
