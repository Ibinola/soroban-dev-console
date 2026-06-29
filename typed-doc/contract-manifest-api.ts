/**
 * Issue #498 (BE-329): Expose a contract manifest API
 *
 * Root cause:
 * - The FixtureManifestModule exposes only hardcoded local test fixtures
 *   (8 contracts defined at build time in FIXTURE_DEFS)
 * - No dynamic API exists to list deployed contracts with full metadata
 *   across networks
 * - The SavedContract model in Prisma stores user-saved contracts per
 *   workspace but has no dedicated read API
 * - The frontend lacks a centralized endpoint to discover available
 *   contracts, their versions, WASM hashes, and deployed networks
 *
 * Fix: Create a ContractManifestModule with a read API that aggregates
 *       fixture manifests + user-saved contracts + deployed contract
 *       metadata into a unified contract manifest endpoint.
 */

// ---- NEW: contract-manifest.module.ts ----
import { Module } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { ContractManifestController } from "./contract-manifest.controller.js";
import { ContractManifestService } from "./contract-manifest.service.js";
import { FixtureManifestService } from "../fixture-manifest/fixture-manifest.service.js";

@Module({
  controllers: [ContractManifestController],
  providers: [ContractManifestService, FixtureManifestService, PrismaService],
  exports: [ContractManifestService],
})
export class ContractManifestModule {}

// ---- NEW: contract-manifest.service.ts ----
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../lib/prisma.service.js";
import { FixtureManifestService } from "../fixture-manifest/fixture-manifest.service.js";

export interface ContractManifestEntry {
  id: string;
  contractId: string;
  network: string;
  label: string | null;
  source: "fixture" | "user" | "deployed";
  version?: string;
  wasmHash?: string | null;
  workspaceId?: string;
  createdAt: string;
}

export interface ContractManifestResponse {
  schemaVersion: 1;
  generatedAt: string;
  total: number;
  entries: ContractManifestEntry[];
}

@Injectable()
export class ContractManifestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fixtureManifest: FixtureManifestService,
  ) {}

  async getManifest(network?: string): Promise<ContractManifestResponse> {
    const entries: ContractManifestEntry[] = [];

    // 1. Fixture contracts (from FixtureManifestService)
    const fixtureManifest = this.fixtureManifest.getManifest();
    for (const f of fixtureManifest.fixtures) {
      if (f.contractId) {
        entries.push({
          id: `fixture:${f.key}`,
          contractId: f.contractId,
          network: f.network,
          label: f.label,
          source: "fixture",
          version: f.version,
          wasmHash: f.wasmHash,
          createdAt: fixtureManifest.generatedAt,
        });
      }
    }

    // 2. User-saved contracts from workspaces
    const savedContracts = await this.prisma.savedContract.findMany({
      where: network ? { network } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    for (const sc of savedContracts) {
      entries.push({
        id: `user:${sc.id}`,
        contractId: sc.contractId,
        network: sc.network,
        label: sc.label,
        source: "user",
        workspaceId: sc.workspaceId,
        createdAt: sc.createdAt.toISOString(),
      });
    }

    // 3. Deployed contracts from workspace artifacts
    const artifacts = await this.prisma.workspaceArtifact.findMany({
      where: {
        kind: "contract",
        ...(network ? { network } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    for (const a of artifacts) {
      entries.push({
        id: `artifact:${a.id}`,
        contractId: a.name,
        network: a.network ?? "unknown",
        label: a.metadata?.["label"] as string ?? a.name,
        source: "deployed",
        wasmHash: a.hash,
        workspaceId: a.workspaceId,
        createdAt: a.createdAt.toISOString(),
      });
    }

    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      total: entries.length,
      entries,
    };
  }
}

// ---- NEW: contract-manifest.controller.ts ----
import { Controller, Get, Query } from "@nestjs/common";
import { ContractManifestService } from "./contract-manifest.service.js";

@Controller("contract-manifest")
export class ContractManifestController {
  constructor(private readonly service: ContractManifestService) {}

  @Get()
  get(@Query("network") network?: string) {
    return this.service.getManifest(network);
  }
}
