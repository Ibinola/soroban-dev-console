import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { NetworkHealthService } from "./network-health.service.js";
import { RpcMetricsService } from "../rpc/rpc-metrics.service.js";
import { DomainEventBus } from "../../lib/domain-event-bus.js";

@Module({
  controllers: [HealthController],
  providers: [NetworkHealthService, RpcMetricsService, DomainEventBus],
  exports: [NetworkHealthService],
})
export class HealthModule {}
