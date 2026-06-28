/**
 * DX-630: Scenario replay pack — API failure investigation.
 *
 * Seeds the local database with:
 * 1. A workspace with a failed RPC call trace
 * 2. An audit log entry for the failed operation
 * 3. A support ticket raised after the failure
 *
 * Usage: npx tsx scripts/replay-packs/api-failure-investigation.ts
 */

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const DB_PATH = process.argv.find((a) => a.startsWith("--db="))?.slice(5) ?? "./apps/api/dev.db";

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${DB_PATH}` } },
});

async function main() {
  const workspaceId = randomUUID();
  const ticketId = randomUUID();

  await prisma.workspace.upsert({
    where: { id: workspaceId },
    update: {},
    create: {
      id: workspaceId,
      ownerKey: "replay-failure-key",
      name: "API Failure Debug Workspace",
      data: JSON.stringify({
        contracts: [],
        calls: [
          {
            id: "failed-call-1",
            method: "invokeContractFunction",
            params: { contract: "CBQZ3V7K2Y4P5W6X7Y8Z9A0B1C2D3E4F5G6H7I8J9K0L" },
            error: "rpc_error_CONNECTION_REFUSED",
            timestamp: new Date().toISOString(),
          },
        ],
      }),
      revision: 1,
    },
  });

  await prisma.auditLog.create({
    data: {
      actor: "system",
      action: "rpc.failed",
      resourceType: "workspace",
      resourceId: workspaceId,
      summary: `RPC call failed for workspace ${workspaceId}: connection refused to testnet endpoint`,
    },
  });

  await prisma.auditLog.create({
    data: {
      actor: "system",
      action: "ticket.created",
      resourceType: "support_ticket",
      resourceId: ticketId,
      summary: `Auto-generated support ticket for RPC failure in workspace ${workspaceId}`,
    },
  });

  console.log(`Seeded API failure investigation scenario:`);
  console.log(`  Workspace: ${workspaceId}`);
  console.log(`  Ticket: ${ticketId}`);
  console.log();
  console.log("Investigation questions:");
  console.log("1. Does the audit log show the RPC failure reason?");
  console.log("2. Was a support ticket auto-generated?");
  console.log("3. Can the workspace state be recovered from the audit trail?");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
