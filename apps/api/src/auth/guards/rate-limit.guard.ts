import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { THROTTLE_POLICY_KEY } from "../decorators/throttle-policy.decorator.js";
import { type ThrottlePolicyName } from "../decorators/throttle-policies.js";
import { RateLimitService } from "../services/rate-limit.service.js";

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const policy = this.reflector.getAllAndOverride<ThrottlePolicyName>(THROTTLE_POLICY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!policy) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: { id?: string } }>();
    const identifier = request.user?.id ?? request.ip ?? "unknown";
    return this.rateLimitService.consume(identifier, policy);
  }
}
