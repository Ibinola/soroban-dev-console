import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { ExplainContractDiffDto, ContractDiffExplainerService } from "./contract-diff-explainer.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("contract-diff-explainer")
@UseGuards(OwnerKeyGuard)
export class ContractDiffExplainerController {
  constructor(private readonly service: ContractDiffExplainerService) {}

  @Post("explain")
  @HttpCode(HttpStatus.OK)
  explain(@Body() dto: ExplainContractDiffDto, @Req() req: Request) {
    return this.service.explain(dto, (req as OwnerKeyRequest).ownerKey);
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
