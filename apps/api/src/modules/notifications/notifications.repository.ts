import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany<T extends Prisma.NotificationEventFindManyArgs>(
    params: Prisma.SelectSubset<T, Prisma.NotificationEventFindManyArgs>,
  ) {
    return this.prisma.notificationEvent.findMany(params);
  }

  async findFirst<T extends Prisma.NotificationEventFindFirstArgs>(
    params: Prisma.SelectSubset<T, Prisma.NotificationEventFindFirstArgs>,
  ) {
    return this.prisma.notificationEvent.findFirst(params);
  }

  async create<T extends Prisma.NotificationEventCreateArgs>(
    params: Prisma.SelectSubset<T, Prisma.NotificationEventCreateArgs>,
  ) {
    return this.prisma.notificationEvent.create(params);
  }

  async update<T extends Prisma.NotificationEventUpdateArgs>(
    params: Prisma.SelectSubset<T, Prisma.NotificationEventUpdateArgs>,
  ) {
    return this.prisma.notificationEvent.update(params);
  }
}
