import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { OwnerKeyGuard } from "../../auth/owner-key.guard.js";
import { NotificationsService } from "./notifications.service.js";
import type { CreateNotificationDto, UpdateDeliveryStatusDto } from "./notifications.service.js";

@Controller("notifications")
@UseGuards(OwnerKeyGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateNotificationDto) {
    return this.service.create(dto);
  }

  @Get("pending")
  listPending() {
    return this.service.listPending();
  }

  @Get("recipient/:recipientId")
  listByRecipient(@Param("recipientId") recipientId: string) {
    return this.service.listByRecipient(recipientId);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Patch(":id/delivery-status")
  @HttpCode(HttpStatus.OK)
  updateDeliveryStatus(@Param("id") id: string, @Body() dto: UpdateDeliveryStatusDto) {
    return this.service.updateDeliveryStatus(id, dto);
  }
}
