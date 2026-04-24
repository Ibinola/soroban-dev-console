import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { NetworkHealthService } from "./network-health.service.js";

@Module({
  controllers: [HealthController],
  providers: [NetworkHealthService],
  exports: [NetworkHealthService],
})
export class HealthModule {}
