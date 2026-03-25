import { Controller, Get } from "@nestjs/common";

@Controller("shares")
export class SharesController {
  @Get("health")
  getStatus() {
    return {
      ok: true,
      message: "Shares module loaded."
    };
  }
}
