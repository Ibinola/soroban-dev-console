import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { SuggestTestCasesDto, TestCaseSuggesterService } from "./test-case-suggester.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("test-case-suggester")
@UseGuards(OwnerKeyGuard)
export class TestCaseSuggesterController {
  constructor(private readonly service: TestCaseSuggesterService) {}

  @Post("suggest")
  @HttpCode(HttpStatus.OK)
  suggest(@Body() dto: SuggestTestCasesDto, @Req() req: Request) {
    return this.service.suggest(dto, (req as OwnerKeyRequest).ownerKey);
  }

  @Get("pr/:pullRequestId")
  getByPr(@Param("pullRequestId") pullRequestId: string) {
    return this.service.getByPr(pullRequestId);
  }

  @Get("list")
  list() {
    return this.service.list();
  }
}
