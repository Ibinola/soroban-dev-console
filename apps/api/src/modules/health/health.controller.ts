import { Controller, Get, Param } from "@nestjs/common";
import { NetworkHealthService } from "./network-health.service.js";
import { RpcMetricsService } from "../rpc/rpc-metrics.service.js";
import { rpcCircuitBreakers } from "../../lib/circuit-breaker.js";
import { rpcCoalescer } from "../../lib/request-coalescer.js";

import { ApiOperation, ApiTags } from "@nestjs/swagger";
@ApiTags("health")
@Controller()
export class HealthController {
  constructor(
    private readonly networkHealth: NetworkHealthService,
    private readonly rpcMetrics: RpcMetricsService,
  ) {}

  @ApiOperation({ summary: "Get health" })
  @Get("health")
  getHealth() {
    return {
      ok: true,
      service: "api",
      version: process.env.npm_package_version ?? "0.1.0",
      timestamp: new Date().toISOString()
    };
  }

  @ApiOperation({ summary: "Get version" })
  @Get("version")
  getVersion() {
    return {
      service: "api",
      version: process.env.npm_package_version ?? "0.1.0"
    };
  }

  /** BE-009: Aggregated health for all supported networks. */
  @ApiOperation({ summary: "Get network health" })
  @Get("health/networks")
  async getNetworkHealth() {
    return this.networkHealth.getAllHealth();
  }

  /** BE-009: Health for a single network. */
  @ApiOperation({ summary: "Get network health by name" })
  @Get("health/networks/:network")
  async getNetworkHealthByName(@Param("network") network: string) {
    return this.networkHealth.getHealth(network);
  }

  @ApiOperation({ summary: "Get rpc metrics" })
  @Get("health/rpc")
  getRpcMetrics() {
    return {
      ...this.rpcMetrics.getMetrics(),
      // #1298: coalescing hit rate. #1300: per-endpoint circuit state.
      coalescing: rpcCoalescer.stats(),
      circuits: rpcCircuitBreakers.snapshot(),
    };
  }
}
