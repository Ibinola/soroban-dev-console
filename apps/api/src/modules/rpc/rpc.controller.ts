import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { RpcRateLimitGuard } from "./rpc-rate-limit.guard.js";
import { RpcService } from "./rpc.service.js";
import { RpcCacheService } from "./rpc-cache.service.js";
import { TransactionNormalizerService } from "./transaction-normalizer.service.js";
import {
  NormalizedTransactionResult,
  NormalizedSimulationPayload,
  ApiResponse,
} from "@devconsole/api-contracts";

@UseGuards(RpcRateLimitGuard)
@Controller("rpc")
export class RpcController {
  constructor(
    private readonly rpcService: RpcService,
    private readonly rpcCache: RpcCacheService,
    private readonly normalizer: TransactionNormalizerService,
  ) {}

  @Post(":network")
  async proxyRpc(
    @Param("network") network: string,
    @Body() payload: unknown,
    @Res({ passthrough: true }) response: Response
  ) {
    const proxied = await this.rpcService.proxy(network, payload);

    response.status(proxied.statusCode);

    if (!proxied.contentType.includes("application/json")) {
      response.type(proxied.contentType);
    }

    return proxied.body;
  }

  @Post(":network/simulate")
  async simulateTransaction(
    @Param("network") network: string,
    @Body() body: { transaction: string },
  ): Promise<ApiResponse<NormalizedSimulationPayload>> {
    const proxied = await this.rpcService.proxy(network, {
      jsonrpc: "2.0",
      id: 1,
      method: "simulateTransaction",
      params: { transaction: body.transaction },
    });

    const result = proxied.body as any;
    const normalized = this.normalizer.normalizeSimulation(result.result || result);

    return {
      success: true,
      data: normalized,
    };
  }

  @Post(":network/send")
  async sendTransaction(
    @Param("network") network: string,
    @Body() body: { transaction: string },
  ): Promise<ApiResponse<NormalizedTransactionResult>> {
    const proxied = await this.rpcService.proxy(network, {
      jsonrpc: "2.0",
      id: 1,
      method: "sendTransaction",
      params: { transaction: body.transaction },
    });

    const result = proxied.body as any;
    const normalized = this.normalizer.normalizeSendTransaction(result.result || result);

    return {
      success: true,
      data: normalized,
    };
  }

  @Post(":network/status")
  async getTransaction(
    @Param("network") network: string,
    @Body() body: { hash: string },
  ): Promise<ApiResponse<NormalizedTransactionResult>> {
    const proxied = await this.rpcService.proxy(network, {
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: { hash: body.hash },
    });

    const result = proxied.body as any;
    const normalized = this.normalizer.normalizeGetTransaction(result.result || result);

    return {
      success: true,
      data: normalized,
    };
  }

  // ── Issue #691: Cache TTL config & invalidation ─────────────────────────────

  @Get("cache/config")
  getCacheConfig() {
    return {
      success: true,
      data: this.rpcCache.getTtlConfig(),
    };
  }

  @Patch("cache/config")
  updateCacheConfig(
    @Body() body: { method: string; ttlMs: number },
  ) {
    this.rpcCache.setTtl(body.method, body.ttlMs);
    return {
      success: true,
      data: this.rpcCache.getTtlConfig(),
    };
  }

  @Delete("cache/all")
  flushAllCache() {
    this.rpcCache.flushAll();
    return { success: true, message: "Cache flushed" };
  }

  @Delete("cache")
  invalidateCache(
    @Query("method") method?: string,
    @Query("network") network?: string,
  ) {
    const count = this.rpcCache.invalidate(method, network);
    return {
      success: true,
      data: { invalidated: count },
    };
  }

  // ── Issue #693: Dedup stats ─────────────────────────────────────────────────

  @Get("dedup/stats")
  getDedupStats() {
    return {
      success: true,
      data: this.rpcCache.getDedupStats(),
    };
  }
}
