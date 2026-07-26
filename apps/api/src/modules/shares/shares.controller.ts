import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { SharesService, CreateShareDto, ForkShareDto, ListSharesDto } from "./shares.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("shares")
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  /** POST /shares — create a share link (requires ownership of the workspace) */
  @Post()
  @UseGuards(OwnerKeyGuard)
  create(@Body() dto: CreateShareDto, @Req() req: Request) {
    return this.sharesService.create((req as OwnerKeyRequest).ownerKey, dto);
  }

  /** GET /shares/:token — public read-only resolve, returns snapshot data only */
  @Get(":token")
  resolve(@Param("token") token: string, @Req() req: Request) {
    const ip = req.ip ?? req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];
    return this.sharesService.resolve(token, ip, userAgent);
  }

  /** DELETE /shares/:token — revoke (requires ownership of the workspace) */
  @Delete(":token")
  @HttpCode(200)
  @UseGuards(OwnerKeyGuard)
  revoke(@Param("token") token: string, @Req() req: Request) {
    return this.sharesService.revoke(token, (req as OwnerKeyRequest).ownerKey);
  }

  /** GET /shares/workspace/:workspaceId — list shares (requires ownership) */
  @Get("workspace/:workspaceId")
  @UseGuards(OwnerKeyGuard)
  listForWorkspace(
    @Param("workspaceId") workspaceId: string,
    @Query() query: ListSharesDto,
    @Req() req: Request,
  ) {
    return this.sharesService.listForWorkspace(
      workspaceId,
      (req as OwnerKeyRequest).ownerKey,
      query,
    );
  }

  /** GET /shares/:token/stats — view count and recent access logs (owner only) */
  @Get(":token/stats")
  @UseGuards(OwnerKeyGuard)
  stats(@Param("token") token: string, @Req() req: Request) {
    return this.sharesService.stats(token, (req as OwnerKeyRequest).ownerKey);
  }

  /** POST /shares/:token/fork — fork share snapshot into a new workspace (owner only) */
  @Post(":token/fork")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OwnerKeyGuard)
  fork(
    @Param("token") token: string,
    @Body() dto: ForkShareDto,
    @Req() req: Request,
  ) {
    return this.sharesService.fork(token, (req as OwnerKeyRequest).ownerKey, dto);
  }

  /** DELETE /shares/cleanup — purge expired and revoked share records */
  @Delete("cleanup")
  @HttpCode(200)
  cleanup() {
    return this.sharesService.cleanup();
  }
}
