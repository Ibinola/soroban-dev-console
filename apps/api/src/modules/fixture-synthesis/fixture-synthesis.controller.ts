import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { SynthesizeFixturesDto, FixtureSynthesisService } from "./fixture-synthesis.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("fixture-synthesis")
@UseGuards(OwnerKeyGuard)
export class FixtureSynthesisController {
  constructor(private readonly service: FixtureSynthesisService) {}

  @Post("synthesize")
  @HttpCode(HttpStatus.OK)
  synthesize(@Body() dto: SynthesizeFixturesDto, @Req() req: Request) {
    return this.service.synthesize(dto, (req as OwnerKeyRequest).ownerKey);
  }

  @Get("context/:contextId")
  getByContext(@Param("contextId") contextId: string) {
    return this.service.getByContext(contextId);
  }

  @Get("list")
  list() {
    return this.service.list();
  }
}
