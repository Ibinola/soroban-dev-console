import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { NotificationsController } from "./notifications.controller.js";
import { NotificationsService } from "./notifications.service.js";
import { NotificationsRepository } from "./notifications.repository.js";

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsRepository, PrismaService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
