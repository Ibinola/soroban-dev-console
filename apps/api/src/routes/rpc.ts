import { Router } from "express";
import { z } from "zod";
import { createRateLimiter } from "../middleware/rate-limiter.js";

const rpcRouter = Router();

const networkSchema = z.enum(["mainnet", "testnet", "futurenet", "local"]);

const singleRpcRequestSchema = z
  .object({
    jsonrpc: z.literal("2.0"),
    method: z.string().trim().min(1),
    params: z.unknown().optional(),
    id: z.union([z.string(), z.number(), z.null()]).optional()
  })
  .passthrough();

const rpcRequestSchema = z.union([
  singleRpcRequestSchema,
  z.array(singleRpcRequestSchema).min(1)
]);

function getRpcUrl(network: z.infer<typeof networkSchema>) {
  const networkRpcUrls = {
    mainnet: process.env.SOROBAN_RPC_MAINNET_URL,
    testnet: process.env.SOROBAN_RPC_TESTNET_URL,
    futurenet: process.env.SOROBAN_RPC_FUTURENET_URL,
    local: process.env.SOROBAN_RPC_LOCAL_URL
  };

  return networkRpcUrls[network];
}

rpcRouter.use(
  createRateLimiter({
    windowMs: 60_000,
    maxRequests: 100
  })
);

rpcRouter.post("/:network", async (req, res) => {
  const parsedNetwork = networkSchema.safeParse(req.params.network);
  if (!parsedNetwork.success) {
    res.status(400).json({
      error: "Unsupported network"
    });
    return;
  }

  const parsedPayload = rpcRequestSchema.safeParse(req.body);
  if (!parsedPayload.success) {
    res.status(400).json({
      error: "Invalid JSON-RPC payload",
      details: parsedPayload.error.flatten()
    });
    return;
  }

  const rpcUrl = getRpcUrl(parsedNetwork.data);
  if (!rpcUrl) {
    res.status(500).json({
      error: `RPC URL is not configured for network '${parsedNetwork.data}'`
    });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const upstreamResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(parsedPayload.data),
      signal: controller.signal
    });

    const rawBody = await upstreamResponse.text();
    const contentType = upstreamResponse.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      try {
        const parsedBody = JSON.parse(rawBody);
        res.status(upstreamResponse.status).json(parsedBody);
        return;
      } catch {
        // fall through and return text body if upstream sent invalid JSON
      }
    }

    res.status(upstreamResponse.status).send(rawBody);
  } catch (error) {
    console.error("RPC proxy request failed", error);
    res.status(502).json({
      error: "Failed to proxy RPC request"
    });
  } finally {
    clearTimeout(timeout);
  }
});

export { rpcRouter };
