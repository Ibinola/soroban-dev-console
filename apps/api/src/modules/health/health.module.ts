import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { NetworkHealthService } from "./network-health.service.js";
import { RpcMetricsService } from "../rpc/rpc-metrics.service.js";
import { DomainEventBus } from "../../lib/domain-event-bus.js";
import { DbPoolMetricsService } from "./db-pool-metrics.service.js";
import { PrismaService } from "../../lib/prisma.service.js";

@Module({
  controllers: [HealthController],
  providers: [NetworkHealthService, RpcMetricsService, DomainEventBus, DbPoolMetricsService, PrismaService],
  exports: [NetworkHealthService],
})
export class HealthModule {}
