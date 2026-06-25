import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { EvidencePackService } from "./evidence-pack.service.js";
import type { EvidencePackInput } from "@devconsole/api-contracts";

@Controller("evidence-packs")
@UseGuards(OwnerKeyGuard)
export class EvidencePackController {
  constructor(private readonly service: EvidencePackService) {}

  @Post()
  assemble(@Body() input: EvidencePackInput) {
    return this.service.assemble(input);
  }
}
