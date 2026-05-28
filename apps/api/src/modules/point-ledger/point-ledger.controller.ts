import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { PointLedgerService } from "./point-ledger.service.js";
import type { LedgerEntry } from "./point-ledger.service.js";

@Controller("point-ledger")
@UseGuards(OwnerKeyGuard)
export class PointLedgerController {
  constructor(private readonly service: PointLedgerService) {}

  @Post("entries")
  @HttpCode(HttpStatus.CREATED)
  addEntry(@Body() dto: LedgerEntry) {
    return this.service.addEntry(dto);
  }

  @Get("balance/:contributorId")
  getBalance(@Param("contributorId") contributorId: string) {
    return this.service.getBalance(contributorId).then((total) => ({ contributorId, total }));
  }

  @Get("integrity")
  verifyIntegrity() {
    return this.service.verifyIntegrity();
  }

  @Post("repair")
  @HttpCode(HttpStatus.OK)
  repair() {
    return this.service.repair();
  }
}
