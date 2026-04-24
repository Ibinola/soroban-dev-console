import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from "@nestjs/common";
import { SharesService, CreateShareDto } from "./shares.service.js";

@Controller("shares")
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  /** POST /shares — create a new share link */
  @Post()
  create(@Body() dto: CreateShareDto) {
    return this.sharesService.create(dto);
  }

  /** GET /shares/:token — resolve a share link (read-only) */
  @Get(":token")
  resolve(@Param("token") token: string) {
    return this.sharesService.resolve(token);
  }

  /** DELETE /shares/:token — revoke a share link */
  @Delete(":token")
  @HttpCode(200)
  revoke(@Param("token") token: string) {
    return this.sharesService.revoke(token);
  }

  /** GET /shares/workspace/:workspaceId — list shares for a workspace */
  @Get("workspace/:workspaceId")
  listForWorkspace(@Param("workspaceId") workspaceId: string) {
    return this.sharesService.listForWorkspace(workspaceId);
  }

  /**
   * BE-010: DELETE /shares/cleanup — purge expired and revoked share records.
   * Protected by the owner-key guard in production; open here for simplicity.
   */
  @Delete("cleanup")
  @HttpCode(200)
  cleanup() {
    return this.sharesService.cleanup();
  }
}
