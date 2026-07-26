import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

export const REQUIRE_PII_EXPORT = "requirePiiExport";
export const RequirePiiExport = () => SetMetadata(REQUIRE_PII_EXPORT, true);

@Injectable()
export class PiiExportGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_PII_EXPORT, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const exportReason = req.headers["x-export-reason"];
    const exportScope = req.headers["x-export-scope"];

    if (!exportReason || typeof exportReason !== "string" || exportReason.trim().length < 10) {
      throw new ForbiddenException(
        "PII export requires a valid x-export-reason header with at least 10 characters describing the purpose",
      );
    }

    if (!exportScope || typeof exportScope !== "string") {
      throw new ForbiddenException(
        "PII export requires a valid x-export-scope header describing the data scope",
      );
    }

    const allowedScopes = ["audit", "compliance", "support", "user_request"];
    if (!allowedScopes.includes(exportScope.trim().toLowerCase())) {
      throw new ForbiddenException(
        `PII export scope must be one of: ${allowedScopes.join(", ")}`,
      );
    }

    (req as any).piiExportContext = {
      reason: exportReason.trim(),
      scope: exportScope.trim().toLowerCase(),
      requestedAt: new Date().toISOString(),
    };

    return true;
  }
}
