import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { EvaluateEscalationDto, ResolveEscalationDto, AiEscalationService } from "./ai-escalation.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("ai-escalation")
@UseGuards(OwnerKeyGuard)
export class AiEscalationController {
  constructor(private readonly service: AiEscalationService) {}

  @Post("evaluate")
  @HttpCode(HttpStatus.OK)
  evaluate(@Body() dto: EvaluateEscalationDto, @Req() req: Request) {
    return this.service.evaluate(dto, (req as OwnerKeyRequest).ownerKey);
  }

  @Patch("output/:outputId/resolve")
  resolve(@Param("outputId") outputId: string, @Body() dto: ResolveEscalationDto, @Req() req: Request) {
    return this.service.resolve(outputId, (req as OwnerKeyRequest).ownerKey, dto);
  }

  @Get("pending")
  getPending() {
    return this.service.getPending();
  }

  @Get("output/:outputId")
  getByOutput(@Param("outputId") outputId: string) {
    return this.service.getByOutput(outputId);
  }
}
