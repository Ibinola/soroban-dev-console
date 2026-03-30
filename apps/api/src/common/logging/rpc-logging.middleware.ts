import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

const REDACTED_KEYS = new Set(["secret", "password", "privateKey", "seed"]);

function redactPayload(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>).map(([k, v]) => [
      k,
      REDACTED_KEYS.has(k) ? "[REDACTED]" : v,
    ])
  );
}

@Injectable()
export class RpcLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger("RpcProxy");

  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = (req as any).correlationId ?? "-";
    const start = Date.now();
    const { method, path: route } = req;
    const network = (req.headers["x-network"] as string) ?? "unknown";

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      const latencyMs = Date.now() - start;
      const status = res.statusCode;

      if (status >= 400) {
        this.logger.warn(
          JSON.stringify({
            correlationId,
            network,
            route,
            method,
            status,
            latencyMs,
            error: typeof body === "object" ? (body as any)?.error : body,
          })
        );
      } else {
        this.logger.log(
          JSON.stringify({
            correlationId,
            network,
            route,
            method,
            status,
            latencyMs,
          })
        );
      }

      return originalJson(body);
    };

    this.logger.debug(
      JSON.stringify({
        correlationId,
        network,
        route,
        method,
        body: redactPayload(req.body),
      })
    );

    next();
  }
}
