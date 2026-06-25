import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { DraftReleaseNotesDto, ReleaseNotesService } from "./release-notes.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("release-notes")
@UseGuards(OwnerKeyGuard)
export class ReleaseNotesController {
  constructor(private readonly service: ReleaseNotesService) {}

  @Post("draft")
  @HttpCode(HttpStatus.OK)
  draft(@Body() dto: DraftReleaseNotesDto, @Req() req: Request) {
    return this.service.draft(dto, (req as OwnerKeyRequest).ownerKey);
  }

  @Get("release/:releaseId")
  getByRelease(@Param("releaseId") releaseId: string) {
    return this.service.getByRelease(releaseId);
  }

  @Get("list")
  list() {
    return this.service.list();
  }
}
