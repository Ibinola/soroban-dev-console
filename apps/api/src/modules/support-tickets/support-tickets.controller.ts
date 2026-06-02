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
  CreateSupportTicketDto,
  ListSupportTicketsDto,
  SupportTicketsService,
  UpdateSupportTicketDto,
} from "./support-tickets.service.js";
import { SupportTicketThrottleGuard } from "./support-ticket-throttle.guard.js";

type OwnerKeyRequest = Request & { ownerKey: string };

@Controller("support-tickets")
@UseGuards(OwnerKeyGuard, SupportTicketThrottleGuard)
export class SupportTicketsController {
  constructor(private readonly service: SupportTicketsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSupportTicketDto, @Req() req: Request) {
    return this.service.create((req as OwnerKeyRequest).ownerKey, dto);
  }

  @Get()
  list(@Query() query: ListSupportTicketsDto) {
    return this.service.list(query);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateSupportTicketDto, @Req() req: Request) {
    return this.service.update(id, (req as OwnerKeyRequest).ownerKey, dto);
  }
}
