import { Module } from "@nestjs/common";
import { RpcController } from "./rpc.controller.js";

@Module({
  controllers: [RpcController]
})
export class RpcModule {}
