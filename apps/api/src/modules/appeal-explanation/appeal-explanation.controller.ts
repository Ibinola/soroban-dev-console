import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { AppealExplanationService } from "./appeal-explanation.service.js";
import type { ReviewEvidencePack } from "@devconsole/api-contracts";

export interface GenerateExplanationDto {
  pack: ReviewEvidencePack;
  outcome: "approved" | "rejected" | "escalated";
  confidence: "high" | "medium" | "low";
}

@Controller("appeal-explanations")
@UseGuards(OwnerKeyGuard)
export class AppealExplanationController {
  constructor(private readonly service: AppealExplanationService) {}

  @Post()
  generate(@Body() dto: GenerateExplanationDto) {
    return this.service.explain(dto.pack, dto.outcome, dto.confidence);
  }
}
