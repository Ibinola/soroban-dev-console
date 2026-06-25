import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { AnalyzeLogsDto, LogAnalyzerService } from "./log-analyzer.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("log-analyzer")
@UseGuards(OwnerKeyGuard)
export class LogAnalyzerController {
  constructor(private readonly service: LogAnalyzerService) {}

  @Post("analyze")
  @HttpCode(HttpStatus.OK)
  analyze(@Body() dto: AnalyzeLogsDto, @Req() req: Request) {
    return this.service.analyze(dto, (req as OwnerKeyRequest).ownerKey);
  }

  @Get("session/:sessionId")
  getBySession(@Param("sessionId") sessionId: string) {
    return this.service.getBySession(sessionId);
  }

  @Get("list")
  list() {
    return this.service.list();
  }
}
