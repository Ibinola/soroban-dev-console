import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { WebhookReplayService } from "./webhook-replay.service.js";
import { WebhookSignatureService } from "./webhook-signature.service.js";

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  constructor(
    private readonly signatureService: WebhookSignatureService,
    private readonly replayService: WebhookReplayService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    this.signatureService.verify(request as Request);
    this.replayService.verify(request as Request);

    return true;
  }
}
