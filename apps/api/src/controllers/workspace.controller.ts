import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const shareIdSchema = z.string().regex(/^[A-Za-z0-9_-]{10,64}$/);

function isJsonCompatible(value: unknown): boolean {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonCompatible);
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(isJsonCompatible);
  }

  return false;
}

const jsonSchema = z
  .unknown()
  .refine(
    (value) => isJsonCompatible(value),
    "argumentsJson must be valid JSON"
  );

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  contracts: z
    .array(
      z.object({
        contractId: z.string().trim().min(1),
        network: z.string().trim().min(1)
      })
    )
    .default([]),
  interactions: z
    .array(
      z.object({
        functionName: z.string().trim().min(1),
        argumentsJson: jsonSchema
      })
    )
    .default([])
});

type WorkspaceWithRelations = Prisma.WorkspaceGetPayload<{
  include: { savedContracts: true; savedInteractions: true };
}>;

function serializeWorkspace(workspace: WorkspaceWithRelations) {
  return {
    id: workspace.id,
    share_id: workspace.shareId,
    name: workspace.name,
    createdAt: workspace.createdAt,
    contracts: workspace.savedContracts.map((contract) => ({
      contractId: contract.contractId,
      network: contract.network
    })),
    interactions: workspace.savedInteractions.map((interaction) => ({
      functionName: interaction.functionName,
      argumentsJson: interaction.argumentsJson
    }))
  };
}

export async function createWorkspace(req: Request, res: Response) {
  const parsed = createWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid payload",
      details: parsed.error.flatten()
    });
    return;
  }

  try {
    const workspace = await prisma.workspace.create({
      data: {
        name: parsed.data.name,
        shareId: nanoid(12),
        savedContracts: {
          create: parsed.data.contracts.map((contract) => ({
            contractId: contract.contractId,
            network: contract.network
          }))
        },
        savedInteractions: {
          create: parsed.data.interactions.map((interaction) => ({
            functionName: interaction.functionName,
            argumentsJson:
              interaction.argumentsJson === null
                ? Prisma.JsonNull
                : (interaction.argumentsJson as Prisma.InputJsonValue)
          }))
        }
      },
      include: {
        savedContracts: true,
        savedInteractions: true
      }
    });

    res.status(201).json(serializeWorkspace(workspace));
  } catch (error) {
    console.error("Failed to create workspace", error);
    res.status(500).json({
      error: "Failed to create workspace"
    });
  }
}

export async function getWorkspaceByShareId(req: Request, res: Response) {
  const parsedShareId = shareIdSchema.safeParse(req.params.share_id);
  if (!parsedShareId.success) {
    res.status(404).json({
      error: "Workspace not found"
    });
    return;
  }

  try {
    const workspace = await prisma.workspace.findUnique({
      where: {
        shareId: parsedShareId.data
      },
      include: {
        savedContracts: true,
        savedInteractions: true
      }
    });

    if (!workspace) {
      res.status(404).json({
        error: "Workspace not found"
      });
      return;
    }

    res.status(200).json(serializeWorkspace(workspace));
  } catch (error) {
    console.error("Failed to fetch workspace", error);
    res.status(500).json({
      error: "Failed to fetch workspace"
    });
  }
}
