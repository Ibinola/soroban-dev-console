import { Module } from "@nestjs/common";
import { DomainEventBus } from "../../lib/domain-event-bus.js";
import { RpcCacheService } from "./rpc-cache.service.js";
import { RpcController } from "./rpc.controller.js";
import { RpcFailoverService } from "./rpc-failover.service.js";
import { RpcRateLimitGuard } from "./rpc-rate-limit.guard.js";
import { RpcService } from "./rpc.service.js";

@Module({
  controllers: [RpcController],
  providers: [RpcService, RpcRateLimitGuard, DomainEventBus, RpcCacheService, RpcFailoverService],
  exports: [RpcService]
})
export class RpcModule {}
