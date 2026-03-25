import { Controller, Param, Post } from "@nestjs/common";

@Controller("rpc")
export class RpcController {
  @Post(":network")
  proxyRpc(@Param("network") network: string) {
    return {
      ok: false,
      network,
      message: "RPC proxy is not implemented yet."
    };
  }
}
