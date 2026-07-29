import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

export interface PermissionBoundary {
  resource: string;
  action: string;
}

export const PERMISSION_BOUNDARY_KEY = "permissionBoundary";
export const RequirePermission = (resource: string, action: string) =>
  SetMetadata(PERMISSION_BOUNDARY_KEY, { resource, action });

@Injectable()
export class PermissionBoundaryGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const boundary = this.reflector.getAllAndOverride<PermissionBoundary>(PERMISSION_BOUNDARY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!boundary) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const ownerKey = (req as any).ownerKey;
    const verifiedKey = (req as any).verifiedKey;

    if (!ownerKey && !verifiedKey) {
      throw new ForbiddenException(
        `Access denied: ${boundary.resource}:${boundary.action} requires authentication`,
      );
    }

    (req as any).permissionContext = {
      resource: boundary.resource,
      action: boundary.action,
      principal: ownerKey ?? verifiedKey,
    };

    return true;
  }
}
