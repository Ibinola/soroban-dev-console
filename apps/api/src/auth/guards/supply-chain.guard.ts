import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

export const REQUIRE_SUPPLY_CHAIN = "requireSupplyChain";
export const RequireSupplyChain = () => SetMetadata(REQUIRE_SUPPLY_CHAIN, true);

@Injectable()
export class SupplyChainGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_SUPPLY_CHAIN, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const buildSignature = req.headers["x-build-signature"];
    const buildManifest = req.headers["x-build-manifest"];

    if (!buildSignature || typeof buildSignature !== "string") {
      throw new ForbiddenException("Missing build signature header for supply-chain verification");
    }

    if (!buildManifest || typeof buildManifest !== "string") {
      throw new ForbiddenException("Missing build manifest header for supply-chain verification");
    }

    (req as any).buildSignature = buildSignature;
    (req as any).buildManifest = buildManifest;
    return true;
  }
}
