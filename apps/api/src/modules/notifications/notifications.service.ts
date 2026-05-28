import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { MapDbErrors } from "../../lib/db-error.mapper.js";
import { NotificationsRepository } from "./notifications.repository.js";

export type NotificationChannel = "in_app" | "email" | "webhook";
export type DeliveryStatus = "pending" | "delivered" | "failed";

export interface CreateNotificationDto {
  recipientId: string;
  eventType: string;
  channel: NotificationChannel;
  payload: Record<string, unknown>;
}

export interface UpdateDeliveryStatusDto {
  status: DeliveryStatus;
  failureReason?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly repository: NotificationsRepository) {}

  @MapDbErrors()
  async create(dto: CreateNotificationDto) {
    return this.repository.create({
      data: {
        recipientId: dto.recipientId,
        eventType: dto.eventType,
        channel: dto.channel,
        payload: dto.payload as Prisma.InputJsonValue,
        deliveryStatus: "pending",
      },
    });
  }

  @MapDbErrors()
  async updateDeliveryStatus(id: string, dto: UpdateDeliveryStatusDto) {
    const existing = await this.repository.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException("Notification event not found");
    return this.repository.update({
      where: { id },
      data: {
        deliveryStatus: dto.status,
        failureReason: dto.failureReason ?? null,
        deliveredAt: dto.status === "delivered" ? new Date() : null,
      },
    });
  }

  @MapDbErrors()
  async listByRecipient(recipientId: string) {
    return this.repository.findMany({
      where: { recipientId },
      orderBy: { createdAt: "desc" },
    });
  }

  @MapDbErrors()
  async listPending() {
    return this.repository.findMany({
      where: { deliveryStatus: "pending" },
      orderBy: { createdAt: "asc" },
    });
  }

  @MapDbErrors()
  async get(id: string) {
    const record = await this.repository.findFirst({ where: { id } });
    if (!record) throw new NotFoundException("Notification event not found");
    return record;
  }
}
