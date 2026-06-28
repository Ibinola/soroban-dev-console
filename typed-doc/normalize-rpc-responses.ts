/**
 * Issue #497 (BE-328): Normalize RPC responses before persistence
 *
 * Root cause:
 * - RpcCacheService caches raw upstream responses as ProxiedRpcResponse
 *   without applying TransactionNormalizerService
 * - When cached responses are served, downstream consumers receive
 *   unnormalized shapes that differ between cache-hit and cache-miss paths
 * - The RpcService.proxy() returns ProxiedRpcResponse directly from
 *   fetchUpstream() without normalizing the body through the
 *   transaction normalizer pipeline
 * - This inconsistency means API consumers must handle both raw Soroban
 *   RPC shapes and potentially different cached shapes
 *
 * Fix: Apply TransactionNormalizerService before caching responses.
 *       Store normalized payloads in the cache and serve normalized
 *       responses consistently regardless of cache state.
 */

// ---- FLAWED (rpc.service.ts lines 143-154) ----
return this.rpcCache.deduplicate(cacheKey, async () => {
  const result = await this.fetchWithFailover(
    endpoints, parsedNetwork.data, method, serializedPayload,
  );
  if (result.statusCode === 200) {
    this.rpcCache.set(cacheKey, method, result); // stores raw response
  }
  return result; // returns raw, unnormalized response
});

// ---- FIXED (rpc.service.ts) ----
import { TransactionNormalizerService } from "./transaction-normalizer.service.js";

@Injectable()
export class RpcService {
  constructor(
    /* ... existing deps ... */
    private readonly normalizer: TransactionNormalizerService,
  ) {}

  async proxy(network: string, payload: unknown): Promise<ProxiedRpcResponse> {
    // ... existing validation ...

    return this.rpcCache.deduplicate(cacheKey, async () => {
      const result = await this.fetchWithFailover(
        endpoints, parsedNetwork.data, method, serializedPayload,
      );

      if (result.statusCode === 200 && result.body) {
        // Normalize before caching for consistent downstream shapes
        const normalized = this.normalizeResponse(method, result.body);
        const normalizedResult: ProxiedRpcResponse = {
          ...result,
          body: normalized,
        };
        this.rpcCache.set(cacheKey, method, normalizedResult);
        return normalizedResult;
      }

      return result;
    });
  }

  private normalizeResponse(method: string, body: unknown): unknown {
    try {
      switch (method) {
        case "simulateTransaction":
          return this.normalizer.normalizeSimulation(body as any);
        case "sendTransaction":
          return this.normalizer.normalizeSendTransaction(body as any);
        case "getTransaction":
          return this.normalizer.normalizeGetTransaction(body as any);
        default:
          return body; // pass through for non-transaction methods
      }
    } catch {
      // If normalization fails, return raw body rather than breaking the request
      return body;
    }
  }
}

// ---- FIXED (rpc-cache.service.ts) ----
// No changes needed to rpc-cache itself — it stores whatever value is
// passed to set(). The normalization now happens upstream in RpcService.
