import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { GenerateTriageDigestDto, TriageDigestService } from "./triage-digest.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("triage-digest")
@UseGuards(OwnerKeyGuard)
export class TriageDigestController {
  constructor(private readonly service: TriageDigestService) {}

  @Post("generate")
  @HttpCode(HttpStatus.OK)
  generate(@Body() dto: GenerateTriageDigestDto, @Req() req: Request) {
    return this.service.generate(dto, (req as OwnerKeyRequest).ownerKey);
  }

  @Get("digest/:digestId")
  getByDigestId(@Param("digestId") digestId: string) {
    return this.service.getByDigestId(digestId);
  }

  @Get("list")
  list() {
    return this.service.list();
  }
}
