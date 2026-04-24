import { Controller, Get, Param } from "@nestjs/common";
import { NetworkHealthService } from "./network-health.service.js";

@Controller()
export class HealthController {
  constructor(private readonly networkHealth: NetworkHealthService) {}

  @Get("health")
  getHealth() {
    return {
      ok: true,
      service: "api",
      version: process.env.npm_package_version ?? "0.1.0",
      timestamp: new Date().toISOString()
    };
  }

  @Get("version")
  getVersion() {
    return {
      service: "api",
      version: process.env.npm_package_version ?? "0.1.0"
    };
  }

  /** BE-009: Aggregated health for all supported networks. */
  @Get("health/networks")
  async getNetworkHealth() {
    return this.networkHealth.getAllHealth();
  }

  /** BE-009: Health for a single network. */
  @Get("health/networks/:network")
  async getNetworkHealthByName(@Param("network") network: string) {
    return this.networkHealth.getHealth(network);
  }
}
