async function simulateJob(id: number, maxDelayMs: number): Promise<{ id: number; ok: boolean }> {
  await new Promise((r) => setTimeout(r, Math.random() * maxDelayMs));
  return { id, ok: Math.random() > 0.1 };
}

export async function stressConcurrency(workers: number, maxDelayMs = 500): Promise<void> {
  const start = Date.now();
  const jobs = Array.from({ length: workers }, (_, i) => simulateJob(i, maxDelayMs));
  const results = await Promise.allSettled(jobs);

  let completed = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.ok) completed++;
    else failed++;
  }

  const elapsed = Date.now() - start;
  console.log(`Concurrency stress complete:`);
  console.log(`  Workers  : ${workers}`);
  console.log(`  Succeeded: ${completed}`);
  console.log(`  Failed   : ${failed}`);
  console.log(`  Duration : ${elapsed}ms`);
}

const workers = parseInt(process.argv[2] ?? "20", 10);
stressConcurrency(workers).catch(console.error);
