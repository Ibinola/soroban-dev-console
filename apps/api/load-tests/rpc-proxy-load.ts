import { performance } from 'node:perf_hooks';

interface LoadTestConfig {
  baseUrl: string;
  concurrency: number;
  totalRequests: number;
}

interface RequestResult {
  status: number;
  durationMs: number;
  isCacheHit: boolean;
}

const config: LoadTestConfig = {
  baseUrl: process.env.TARGET_URL || 'http://localhost:3000',
  concurrency: Number(process.env.CONCURRENCY) || 50,
  totalRequests: Number(process.env.TOTAL_REQUESTS) || 500,
};

function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}

async function sendRpcRequest(url: string, requestId: number): Promise<RequestResult> {
  const payload = {
    jsonrpc: '2.0',
    method: 'getLatestLedger',
    params: {},
    id: requestId,
  };

  const start = performance.now();
  try {
    const response = await fetch(`${url}/api/v1/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const durationMs = performance.now() - start;
    const cacheHeader = response.headers.get('x-cache') || response.headers.get('cf-cache-status');
    const isCacheHit = cacheHeader?.toUpperCase() === 'HIT';

    return {
      status: response.status,
      durationMs,
      isCacheHit,
    };
  } catch (error) {
    const durationMs = performance.now() - start;
    return {
      status: 500,
      durationMs,
      isCacheHit: false,
    };
  }
}

async function runLoadTest() {
  console.info(`[LOAD_TEST] Starting RPC Proxy Load Test against ${config.baseUrl}`);
  console.info(`[LOAD_TEST] Concurrency: ${config.concurrency} | Total Requests: ${config.totalRequests}`);

  const results: RequestResult[] = [];
  let completed = 0;

  const worker = async (idPool: number[]) => {
    while (idPool.length > 0) {
      const reqId = idPool.shift();
      if (reqId === undefined) break;

      const result = await sendRpcRequest(config.baseUrl, reqId);
      results.push(result);
      completed++;

      if (completed % 50 === 0 || completed === config.totalRequests) {
        console.info(`[PROGRESS] Completed ${completed}/${config.totalRequests} requests...`);
      }
    }
  };

  const idPool = Array.from({ length: config.totalRequests }, (_, i) => i + 1);
  const workers = Array.from({ length: Math.min(config.concurrency, config.totalRequests) }, () => worker(idPool));

  const startTime = performance.now();
  await Promise.all(workers);
  const totalDurationSec = (performance.now() - startTime) / 1000;

  // Analyze Results
  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const p50 = calculatePercentile(durations, 50);
  const p95 = calculatePercentile(durations, 95);
  const p99 = calculatePercentile(durations, 99);

  const statusCounts = results.reduce<Record<number, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const cacheHits = results.filter((r) => r.isCacheHit).length;
  const cacheHitRate = (cacheHits / config.totalRequests) * 100;
  const rateLimitRejections = statusCounts[429] || 0;

  console.info('\n========================================');
  console.info('           LOAD TEST REPORT             ');
  console.info('========================================');
  console.info(`Total Duration:      ${totalDurationSec.toFixed(2)}s`);
  console.info(`Requests / Sec:      {(config.totalRequests / totalDurationSec).toFixed(2)} req/s`);
  console.info(`--- Response Times ---`);
  console.info(`p50 Latency:         ${p50.toFixed(2)} ms`);
  console.info(`p95 Latency:         ${p95.toFixed(2)} ms`);
  console.info(`p99 Latency:         ${p99.toFixed(2)} ms`);
  console.info(`--- Caching & Limits ---`);
  console.info(`Cache Hit Rate:      ${cacheHitRate.toFixed(1)}% (${cacheHits}/${config.totalRequests})`);
  console.info(`Rate Limits (429):   ${rateLimitRejections}`);
  console.info(`--- Status Breakdown ---`);
  for (const [status, count]  of Object.entries(statusCounts)) {
    console.info(`HTTP ${status}:          ${count} requests`);
  }
  console.info('========================================\n');
}

runLoadTest().catch((err) => {
  console.error('[LOAD_TEST_ERROR]', err);
  process.exit(1);
});