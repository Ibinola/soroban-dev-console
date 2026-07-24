import { Body, Controller, Param, Post, Get, Res, Req, UseGuards, ForbiddenException } from "@nestjs/common";
import type { Request, Response } from "express";
import { RpcRateLimitGuard } from "./rpc-rate-limit.guard.js";
import { RpcService } from "./rpc.service.js";
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
}
