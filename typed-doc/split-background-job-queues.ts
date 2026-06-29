/**
 * Issue #496 (BE-327): Split background jobs into clearer queues
 *
 * Root cause:
 * - BackgroundJobService already has a `queue` field on EnqueueJobOptions
 *   and Prisma schema (INFRA-820), but all jobs default to queue "default"
 * - No queue topology is enforced — there are no named queue constants,
 *   no per-queue worker pools, and no queue-specific concurrency limits
 * - The BackgroundJobModule is monolithic with a single controller and
 *   no domain-specific queue modules
 * - This makes it impossible to prioritize critical jobs (e.g., RPC proxy,
 *   verification) over lower-priority ones (e.g., audit cleanup, notifications)
 *
 * Fix: Define named queue constants, split the monolithic module into
 *       domain-specific queue modules, and add per-queue worker config.
 */

// ---- NEW: constants/queues.ts ----
export const QUEUES = {
  DEFAULT: "default",
  RPC: "rpc",
  VERIFICATION: "verification",
  NOTIFICATION: "notification",
  AUDIT: "audit",
  APPEAL: "appeal",
  BUDGET: "budget",
  CLEANUP: "cleanup",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

// Priority tiers: higher = more urgent
export const QUEUE_PRIORITY: Record<QueueName, number> = {
  [QUEUES.RPC]: 100,
  [QUEUES.VERIFICATION]: 80,
  [QUEUES.APPEAL]: 60,
  [QUEUES.BUDGET]: 50,
  [QUEUES.NOTIFICATION]: 40,
  [QUEUES.AUDIT]: 30,
  [QUEUES.CLEANUP]: 10,
  [QUEUES.DEFAULT]: 0,
};

// Per-queue worker concurrency limits
export const QUEUE_CONCURRENCY: Record<QueueName, number> = {
  [QUEUES.RPC]: 5,
  [QUEUES.VERIFICATION]: 3,
  [QUEUES.APPEAL]: 2,
  [QUEUES.BUDGET]: 2,
  [QUEUES.NOTIFICATION]: 3,
  [QUEUES.AUDIT]: 1,
  [QUEUES.CLEANUP]: 1,
  [QUEUES.DEFAULT]: 3,
};

// ---- NEW: domain-specific queue modules ----
// Each queue module registers a dedicated processor for its job types.

// rpc-queue.module.ts
@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.RPC }),
    forwardRef(() => RpcModule),
  ],
  providers: [RpcQueueProcessor],
})
export class RpcQueueModule {}

// verification-queue.module.ts
@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.VERIFICATION }),
    forwardRef(() => VerificationModule),
  ],
  providers: [VerificationQueueProcessor],
})
export class VerificationQueueModule {}

// etc. for each domain queue

// ---- FIXED background-job.service.ts usage ----
import { QUEUES, QUEUE_PRIORITY } from "./constants/queues.js";

// When enqueueing jobs, callers specify the queue:
await this.jobs.enqueue({
  type: "rpc.proxy",
  payload: { network, method, params },
  queue: QUEUES.RPC,
  priority: QUEUE_PRIORITY[QUEUES.RPC],
  maxAttempts: 3,
});

// ---- FIXED claimNext — queue-aware claiming ----
// Already supported via the optional `queue` filter parameter.
// Workers now claim jobs from their designated queue:
const job = await this.jobs.claimNext("rpc.proxy", QUEUES.RPC);

// ---- FIXED worker config ----
// BackgroundJobService now exposes per-queue concurrency:
async getWorkerConfig(): Promise<{ concurrency: number; queues: Record<string, number> }> {
  return {
    concurrency: this.concurrency,
    queues: QUEUE_CONCURRENCY,
  };
}
