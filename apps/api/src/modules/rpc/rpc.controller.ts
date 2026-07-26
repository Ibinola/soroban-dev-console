import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, Req, Sse, MessageEvent, UseGuards, ForbiddenException } from "@nestjs/common";
import { Observable, interval, Subject, takeUntil } from "rxjs";
import type { Request, Response } from "express";
import { RpcRateLimitGuard } from "./rpc-rate-limit.guard.js";
import { RpcService } from "./rpc.service.js";
import { RpcCacheService } from "./rpc-cache.service.js";
import { RpcFailoverService } from "./rpc-failover.service.js";
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
    private readonly failover: RpcFailoverService,
  ) {}

  @Get("endpoints/status")
  getEndpointStatus(@Req() req: Request) {
    const ip = req.ip || req.socket?.remoteAddress;
    if (ip !== "::1" && ip !== "127.0.0.1" && ip !== "::ffff:127.0.0.1") {
      throw new ForbiddenException("Only internal localhost requests allowed");
    }
    return {
      success: true,
      data: this.failover.getStatus(),
    };
  }

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

  /**
   * Issue #735: SSE endpoint for real-time transaction status streaming.
   *
   * GET /api/rpc/:network/tx/:hash/status
   *
   * Streams MessageEvents with the latest NormalizedTransactionResult until
   * the transaction finalizes (status "success" or "failed") or 120 s elapses.
   * The client can close the connection at any time.
   */
  @Sse(":network/tx/:hash/status")
  streamTxStatus(
    @Param("network") network: string,
    @Param("hash") hash: string,
    @Req() _req: Request,
  ): Observable<MessageEvent> {
    const POLL_INTERVAL_MS = 2_000;
    const TIMEOUT_MS = 120_000;
    const stop$ = new Subject<void>();

    // Automatically stop streaming after the timeout
    const timeoutHandle = setTimeout(() => stop$.next(), TIMEOUT_MS);

    const source$ = new Observable<MessageEvent>((subscriber) => {
      const tick = async () => {
        try {
          const proxied = await this.rpcService.proxy(network, {
            jsonrpc: "2.0",
            id: 1,
            method: "getTransaction",
            params: { hash },
          });

          const body = proxied.body as any;
          const normalized = this.normalizer.normalizeGetTransaction(
            body?.result ?? body,
          );

          subscriber.next({
            data: JSON.stringify({ success: true, data: normalized }),
            type: "message",
          } as MessageEvent);

          // Close the stream once the transaction has reached a terminal state
          if (normalized.status === "success" || normalized.status === "failed") {
            clearTimeout(timeoutHandle);
            stop$.next();
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          subscriber.next({
            data: JSON.stringify({ success: false, error: message }),
            type: "error",
          } as MessageEvent);
        }
      };

      // Emit immediately, then on every interval tick
      void tick();
      const sub = interval(POLL_INTERVAL_MS).subscribe(() => void tick());

      return () => {
        sub.unsubscribe();
        clearTimeout(timeoutHandle);
        stop$.complete();
      };
    });

    return source$.pipe(takeUntil(stop$));
  }
}
