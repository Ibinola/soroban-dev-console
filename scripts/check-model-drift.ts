/**
 * AI-214: Automated metric collection for the AI monitoring pipeline.
 *
 * Reads live data from the database and posts snapshots to the
 * ai-monitor endpoint. Run on a schedule (cron, CI, or manually)
 * to keep the drift dashboard current.
 *
 * Usage:
 *   tsx scripts/check-model-drift.ts
 *
 * Env vars required:
 *   DATABASE_URL  -- SQLite path (same as API)
 *   API_BASE_URL  -- e.g. http://localhost:4000
 *   MONITOR_OWNER_KEY -- x-owner-key for the API request
 */

import { PrismaClient } from "@prisma/client";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000";
const OWNER_KEY = process.env.MONITOR_OWNER_KEY ?? "";
const WINDOW_HOURS = 24;

const prisma = new PrismaClient();

async function postSnapshot(
  metricType: string,
  value: number,
  metadata: Record<string, unknown>,
) {
  const res = await fetch(`${API_BASE}/ai-monitor/snapshot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-owner-key": OWNER_KEY,
    },
    body: JSON.stringify({ metricType, value, windowHours: WINDOW_HOURS, metadata }),
  });
  if (!res.ok) throw new Error(`snapshot failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function measureOverrideRate() {
  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);
  const [total, overridden] = await Promise.all([
    prisma.ticketClassification.count({ where: { createdAt: { gte: since } } }),
    prisma.ticketClassification.count({ where: { humanOverride: true, createdAt: { gte: since } } }),
  ]);
  const rate = total > 0 ? overridden / total : 0;
  return { value: Math.round(rate * 1000) / 1000, metadata: { total, overridden, windowHours: WINDOW_HOURS } };
}

async function measureClassificationPrecision() {
  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);
  const [total, highConfidence] = await Promise.all([
    prisma.ticketClassification.count({ where: { createdAt: { gte: since } } }),
    prisma.ticketClassification.count({ where: { confidence: { gte: 0.7 }, createdAt: { gte: since } } }),
  ]);
  const precision = total > 0 ? highConfidence / total : 1;
  return { value: Math.round(precision * 1000) / 1000, metadata: { total, highConfidence, windowHours: WINDOW_HOURS } };
}

async function measureFairnessDrift() {
  const orgs = await prisma.organizationBudget.findMany({
    select: { organizationId: true, usedPoints: true, capPoints: true },
  });
  if (orgs.length < 2) return { value: 0, metadata: { orgCount: orgs.length } };
  const ratios = orgs
    .filter((o) => o.capPoints > 0)
    .map((o) => o.usedPoints / o.capPoints);
  if (ratios.length < 2) return { value: 0, metadata: { orgCount: orgs.length } };
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const variance = ratios.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / ratios.length;
  const drift = Math.round(Math.sqrt(variance) * 1000) / 1000;
  return { value: drift, metadata: { orgCount: orgs.length, mean: Math.round(mean * 1000) / 1000 } };
}

async function measureQueueHealth() {
  const [total, open] = await Promise.all([
    prisma.supportTicket.count(),
    prisma.supportTicket.count({ where: { status: "open" } }),
  ]);
  const resolved = total - open;
  const health = total > 0 ? resolved / total : 1;
  return { value: Math.round(health * 1000) / 1000, metadata: { total, open, resolved } };
}

async function main() {
  if (!OWNER_KEY) {
    console.error("MONITOR_OWNER_KEY is required");
    process.exit(1);
  }

  console.log(`[check-model-drift] window=${WINDOW_HOURS}h api=${API_BASE}`);

  const metrics: Array<{ type: string; fn: () => Promise<{ value: number; metadata: Record<string, unknown> }> }> = [
    { type: "override_rate", fn: measureOverrideRate },
    { type: "classification_precision", fn: measureClassificationPrecision },
    { type: "fairness_drift", fn: measureFairnessDrift },
    { type: "queue_health", fn: measureQueueHealth },
  ];

  let hasAlert = false;

  for (const { type, fn } of metrics) {
    try {
      const { value, metadata } = await fn();
      const snapshot = await postSnapshot(type, value, metadata);
      const alert = snapshot.alertTriggered ? " [ALERT]" : "";
      console.log(`  ${type}: ${value}${alert}`);
      if (snapshot.alertTriggered) hasAlert = true;
    } catch (err) {
      console.error(`  ${type}: failed --`, err);
    }
  }

  await prisma.$disconnect();

  if (hasAlert) {
    console.log("[check-model-drift] one or more alert thresholds breached -- review /ai-monitor/alerts");
    process.exit(2);
  }

  console.log("[check-model-drift] all metrics within thresholds");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
