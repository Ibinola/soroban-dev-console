import { timingSafeEqual } from "node:crypto";
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

/**
 * Protects operator-only endpoints. The caller must send the `x-admin-key`
 * header matching the `ADMIN_API_KEY` environment variable. If no key is
 * configured the endpoint is closed to everyone.
 */
@Injectable()
export class AdminKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ADMIN_API_KEY;
    if (!expected) {
      throw new ForbiddenException("Admin API is not configured");
    }
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers["x-admin-key"];
    if (typeof provided !== "string" || provided.length === 0) {
      throw new UnauthorizedException("Missing admin credentials");
    }
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException("Invalid admin credentials");
    }
    return true;
  }
}
