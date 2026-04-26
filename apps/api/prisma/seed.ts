import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const workspaceId = "demo-workspace";

  const workspace = await prisma.workspace.upsert({
    where: { id: workspaceId },
    update: {
      ownerKey: "demo-owner",
      name: "Demo Workspace",
      description: "Seeded workspace for local API development",
      selectedNetwork: "testnet"
    },
    create: {
      id: workspaceId,
      ownerKey: "demo-owner",
      name: "Demo Workspace",
      description: "Seeded workspace for local API development",
      selectedNetwork: "testnet"
    }
  });

  await prisma.savedContract.deleteMany({
    where: { workspaceId: workspace.id }
  });
  await prisma.savedInteraction.deleteMany({
    where: { workspaceId: workspace.id }
  });
  await prisma.workspaceArtifact.deleteMany({
    where: { workspaceId: workspace.id }
  });

  await prisma.savedContract.createMany({
    data: [
      {
        workspaceId: workspace.id,
        contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        network: "testnet",
        label: "Demo Token"
      }
    ]
  });

  await prisma.savedInteraction.createMany({
    data: [
      {
        workspaceId: workspace.id,
        contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        functionName: "balance",
        name: "Check Demo Balance",
        network: "testnet",
        argumentsJson: [{ name: "id", type: "address", value: "GDEMOACCOUNT" }]
      }
    ]
  });

  await prisma.workspaceArtifact.createMany({
    data: [
      {
        workspaceId: workspace.id,
        kind: "wasm",
        name: "demo-token.wasm",
        network: "testnet",
        hash: "demo-wasm-hash",
        metadata: {
          uploadedBy: "seed",
          functions: ["balance", "transfer", "mint"]
        }
      }
    ]
  });

  await prisma.shareLink.upsert({
    where: { token: "demo-share-link" },
    update: {
      label: "Demo Share",
      snapshotJson: {
        workspaceId: workspace.id,
        selectedNetwork: "testnet",
        contracts: [
          {
            contractId:
              "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
            label: "Demo Token"
          }
        ]
      }
    },
    create: {
      workspaceId: workspace.id,
      token: "demo-share-link",
      label: "Demo Share",
      snapshotJson: {
        workspaceId: workspace.id,
        selectedNetwork: "testnet",
        contracts: [
          {
            contractId:
              "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
            label: "Demo Token"
          }
        ]
      }
    }
  });
}

main()
  .catch((error) => {
    console.error("Prisma seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
