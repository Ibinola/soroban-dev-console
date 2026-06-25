import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { AnalyzeChangeImpactDto, ChangeImpactService } from "./change-impact.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("change-impact")
@UseGuards(OwnerKeyGuard)
export class ChangeImpactController {
  constructor(private readonly service: ChangeImpactService) {}

  @Post("analyze")
  @HttpCode(HttpStatus.OK)
  analyze(@Body() dto: AnalyzeChangeImpactDto, @Req() req: Request) {
    return this.service.analyze(dto, (req as OwnerKeyRequest).ownerKey);
  }

  @Get("diff/:diffId")
  getByDiff(@Param("diffId") diffId: string) {
    return this.service.getByDiff(diffId);
  }

  @Get("list")
  list() {
    return this.service.list();
  }
}
