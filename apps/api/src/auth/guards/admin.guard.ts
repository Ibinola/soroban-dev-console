import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { createHash, timingSafeEqual } from "node:crypto";

export const REQUIRE_ADMIN = "requireAdmin";
export const RequireAdmin = () => SetMetadata(REQUIRE_ADMIN, true);

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_ADMIN, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const adminKey = req.headers["x-admin-key"];

    if (!adminKey || typeof adminKey !== "string") {
      throw new ForbiddenException("Admin access requires x-admin-key header");
    }

    const configuredKey = process.env.ADMIN_API_KEY;
    if (!configuredKey) {
      throw new ForbiddenException("Admin access is not configured (ADMIN_API_KEY not set)");
    }

    const providedHash = createHash("sha256").update(adminKey).digest();
    const configuredHash = createHash("sha256").update(configuredKey).digest();

    if (providedHash.length !== configuredHash.length) {
      throw new ForbiddenException("Invalid admin key");
    }

    if (!timingSafeEqual(providedHash, configuredHash)) {
      throw new ForbiddenException("Invalid admin key");
    }

    (req as any).adminContext = {
      authenticated: true,
      authenticatedAt: new Date().toISOString(),
    };

    return true;
  }
}
