import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import {
  ClassifyTicketDto,
  OverrideClassificationDto,
  TicketClassifierService,
} from "./ticket-classifier.service.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("ticket-classifier")
@UseGuards(OwnerKeyGuard)
export class TicketClassifierController {
  constructor(private readonly service: TicketClassifierService) {}

  @Post("classify")
  @HttpCode(HttpStatus.OK)
  classify(@Body() dto: ClassifyTicketDto, @Req() req: Request) {
    return this.service.classify(dto, (req as OwnerKeyRequest).ownerKey);
  }

  @Get("ticket/:ticketId")
  getByTicket(@Param("ticketId") ticketId: string) {
    return this.service.getByTicket(ticketId);
  }

  @Patch("ticket/:ticketId/override")
  override(
    @Param("ticketId") ticketId: string,
    @Body() dto: OverrideClassificationDto,
    @Req() req: Request,
  ) {
    return this.service.override(ticketId, (req as OwnerKeyRequest).ownerKey, dto);
  }

  @Get("route/:route")
  listByRoute(@Param("route") route: string) {
    return this.service.listByRoute(route);
  }
}
