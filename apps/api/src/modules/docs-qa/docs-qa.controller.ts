import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { AskDocsDto, DocsQaService } from "./docs-qa.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("docs-qa")
@UseGuards(OwnerKeyGuard)
export class DocsQaController {
  constructor(private readonly service: DocsQaService) {}

  @Post("ask")
  @HttpCode(HttpStatus.OK)
  ask(@Body() dto: AskDocsDto, @Req() req: Request) {
    return this.service.ask(dto, (req as OwnerKeyRequest).ownerKey);
  }

  @Get("question/:questionId")
  getByQuestion(@Param("questionId") questionId: string) {
    return this.service.getByQuestion(questionId);
  }

  @Get("list")
  list() {
    return this.service.list();
  }
}
