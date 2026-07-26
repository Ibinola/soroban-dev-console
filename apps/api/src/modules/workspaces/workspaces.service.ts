import { Prisma } from "@prisma/client";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { WorkspacesRepository } from "./workspaces.repository.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";
import { assertSupportedImportVersion, API_SNAPSHOT_VERSION } from "../../lib/schema-version.js";
import { DomainEventBus } from "../../lib/domain-event-bus.js";
import {
  WORKSPACE_CREATED,
  WORKSPACE_UPDATED,
  WORKSPACE_DELETED,
  WORKSPACE_IMPORTED,
  WORKSPACE_EXPORTED,
} from "../../lib/domain-events.js";
import { AuditService } from "../../lib/audit.service.js";
import type {
  CreateWorkspaceDto,
  ImportWorkspaceDto,
  ListWorkspacesDto,
  PaginatedResponse,
  UpdateWorkspaceDto,
} from "./workspace.dto.js";
import { ZipArchive } from "archiver";
import { PassThrough } from "stream";

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly repository: WorkspacesRepository,
    private readonly events: DomainEventBus,
    private readonly audit: AuditService,
  ) { }

  @MapDbErrors()
  async list(ownerKey: string, query: ListWorkspacesDto = {}): Promise<PaginatedResponse<any>> {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;
    const sortBy = query.sortBy ?? "updatedAt";
    const sortOrder = query.sortOrder ?? "desc";

    const where = {
      ownerKey,
      ...(query.network ? { selectedNetwork: query.network } : {}),
      ...(query.includeArchived ? {} : { archived: false }),
    };

    const select = {
      id: true,
      name: true,
      description: true,
      selectedNetwork: true,
      archived: true,
      revision: true,
      createdAt: true,
      updatedAt: true,
    };

    const [data, total] = await Promise.all([
      this.repository.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        select,
        skip,
        take,
      }),
      this.repository.count({ where }),
    ]);

    return { data, pagination: { total, skip, take } };
  }

  @MapDbErrors()
  async get(id: string, ownerKey: string) {
    const workspace = await this.repository.findFirst({
      where: { id, ownerKey },
      include: {
        savedContracts: true,
        savedInteractions: true,
        artifacts: true,
        shares: {
          select: {
            id: true,
            token: true,
            label: true,
            expiresAt: true,
            revokedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    return workspace;
  }

  /**
   * BE-320: Workspace mutation API boundary.
   *
   * Command boundary: perform the DB mutation and return the mutated entity.
   * Side-effects boundary: emit domain events and audit logs *after* the mutation.
   */
  private async runMutationWithSideEffects<T>(
    command: () => Promise<T>,
    sideEffects: (result: T) => void | Promise<void>,
  ): Promise<T> {
    const result = await command();
    await sideEffects(result);
    return result;
  }

  @MapDbErrors()
  async create(ownerKey: string, dto: CreateWorkspaceDto) {
    const network = dto.selectedNetwork ?? "testnet";

    return this.runMutationWithSideEffects(
      async () => {
        const workspace = await this.repository.create({
          data: {
            ownerKey,
            name: dto.name.trim(),
            description: dto.description?.trim() || null,
            selectedNetwork: network,
            savedContracts: dto.contracts
              ? {
                create: dto.contracts.map((c) => ({
                  contractId: c.contractId,
                  network: c.network || network,
                })),
              }
              : undefined,
            savedInteractions: dto.interactions
              ? {
                create: dto.interactions.map((i) => ({
                  functionName: i.functionName,
                  argumentsJson: (i.argumentsJson || {}) as Prisma.InputJsonValue,
                  network: network,
                })),
              }
              : undefined,
          },
        });
        return workspace;
      },
      (workspace) => {
        this.events.emit(WORKSPACE_CREATED, {
          workspaceId: workspace.id,
          ownerKey,
          name: workspace.name,
          selectedNetwork: workspace.selectedNetwork,
        });
        void this.audit.log({
          actor: ownerKey,
          action: "workspace.created",
          resourceType: "workspace",
          resourceId: workspace.id,
          summary: `Created workspace "${workspace.name}"`,
        });
      },
    );
  }


  @MapDbErrors()
  async update(id: string, ownerKey: string, dto: UpdateWorkspaceDto) {
    const current = await this.get(id, ownerKey);

    // BE-006: Reject stale updates when the caller supplies a revision.
    if (dto.revision !== undefined && dto.revision !== (current as any).revision) {
      throw new ConflictException(
        `Workspace has been modified (expected revision ${dto.revision}, got ${(current as any).revision}). Reload and retry.`,
      );
    }

    const changes = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.selectedNetwork !== undefined
        ? { selectedNetwork: dto.selectedNetwork }
        : {}),
      ...(dto.archived !== undefined ? { archived: dto.archived } : {}),
    };

    return this.runMutationWithSideEffects(
      async () => {
        return this.repository.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.description !== undefined
              ? { description: dto.description.trim() || null }
              : {}),
            ...(dto.selectedNetwork !== undefined
              ? { selectedNetwork: dto.selectedNetwork }
              : {}),
            ...(dto.archived !== undefined ? { archived: dto.archived } : {}),
            revision: { increment: 1 },
          },
        });
      },
      (workspace) => {
        this.events.emit(WORKSPACE_UPDATED, {
          workspaceId: workspace.id,
          ownerKey,
          changes,
        });
        void this.audit.log({
          actor: ownerKey,
          action: "workspace.updated",
          resourceType: "workspace",
          resourceId: workspace.id,
          summary: `Updated workspace`,
          metadata: { changes: dto as Record<string, unknown> } as Prisma.InputJsonValue,
        });
      },
    );
  }


  @MapDbErrors()
  async remove(id: string, ownerKey: string) {
    await this.get(id, ownerKey);

    await this.runMutationWithSideEffects(
      async () => {
        await this.repository.delete({ where: { id } });
        return undefined;
      },
      () => {
        this.events.emit(WORKSPACE_DELETED, { workspaceId: id, ownerKey });
        void this.audit.log({
          actor: ownerKey,
          action: "workspace.deleted",
          resourceType: "workspace",
          resourceId: id,
        });
      },
    );
  }


  @MapDbErrors()
  async import(ownerKey: string, dto: ImportWorkspaceDto) {
    try {
      assertSupportedImportVersion(dto.version);
    } catch (err: unknown) {
      throw new BadRequestException(
        err instanceof Error ? err.message : "Unsupported workspace version",
      );
    }

    const existing = await this.repository.findUnique({
      where: { id: dto.id },
    });
    if (existing) {
      throw new ConflictException(
        `A workspace with id "${dto.id}" already exists.`,
      );
    }

    return this.runMutationWithSideEffects(
      async () => {
        return this.repository.create({
          data: {
            id: dto.id,
            ownerKey,
            name: dto.name.trim(),
            description: null,
            selectedNetwork: dto.selectedNetwork,
            savedContracts: {
              create: dto.contractIds.map((contractId) => ({
                contractId,
                network: dto.selectedNetwork,
              })),
            },
            artifacts: {
              create: dto.artifactRefs.map((artifact) => ({
                kind: artifact.kind,
                name: artifact.id,
                network: dto.selectedNetwork,
                hash: artifact.kind === "wasm" ? artifact.id : null,
                metadata: { sourceId: artifact.id },
              })),
            },
          },
        });
      },
      (workspace) => {
        this.events.emit(WORKSPACE_IMPORTED, {
          workspaceId: workspace.id,
          ownerKey,
          version: dto.version,
        });
        void this.audit.log({
          actor: ownerKey,
          action: "workspace.imported",
          resourceType: "workspace",
          resourceId: workspace.id,
          summary: `Imported workspace "${workspace.name}"`,
          metadata: { version: dto.version },
        });
      },
    );
  }


  @MapDbErrors()
  async export(id: string, ownerKey: string) {
    const workspace = await this.repository.findFirst({
      where: { id, ownerKey },
      include: {
        savedContracts: true,
        savedInteractions: true,
        artifacts: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    const snapshot = {
      version: API_SNAPSHOT_VERSION,
      id: workspace.id,
      name: workspace.name,
      selectedNetwork: workspace.selectedNetwork,
      contractIds: workspace.savedContracts.map((contract) => contract.contractId),
      savedCallIds: workspace.savedInteractions.map((interaction) => interaction.id),
      artifactRefs: workspace.artifacts.map((artifact) => ({
        kind: artifact.kind,
        id: artifact.hash || artifact.name,
      })),
      createdAt: workspace.createdAt.getTime(),
      updatedAt: workspace.updatedAt.getTime(),
    };

    // Export is a read-only operation; still route through the same side-effects boundary.
    await this.runMutationWithSideEffects(
      async () => snapshot,
      async () => {
        this.events.emit(WORKSPACE_EXPORTED, { workspaceId: id, ownerKey });
        void this.audit.log({
          actor: ownerKey,
          action: "workspace.exported",
          resourceType: "workspace",
          resourceId: id,
        });
      },
    );

    return snapshot;
  }

  @MapDbErrors()
  async exportZip(id: string, ownerKey: string): Promise<PassThrough> {
    const workspace = await this.repository.findFirst({
      where: { id, ownerKey },
      include: {
        savedContracts: true,
        savedInteractions: true,
        artifacts: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    const snapshot = {
      version: API_SNAPSHOT_VERSION,
      id: workspace.id,
      name: workspace.name,
      selectedNetwork: workspace.selectedNetwork,
      contractIds: workspace.savedContracts.map((contract) => contract.contractId),
      savedCallIds: workspace.savedInteractions.map((interaction) => interaction.id),
      artifactRefs: workspace.artifacts.map((artifact) => ({
        kind: artifact.kind,
        id: artifact.hash || artifact.name,
      })),
      createdAt: workspace.createdAt.getTime(),
      updatedAt: workspace.updatedAt.getTime(),
    };

    const contracts = workspace.savedContracts.map((c) => ({
      id: c.id,
      contractId: c.contractId,
      network: c.network,
      label: c.label,
      createdAt: c.createdAt,
    }));

    const interactions = workspace.savedInteractions.map((i) => ({
      id: i.id,
      contractId: i.contractId,
      functionName: i.functionName,
      name: i.name,
      network: i.network,
      argumentsJson: i.argumentsJson,
      createdAt: i.createdAt,
    }));

    const artifacts = workspace.artifacts.map((a) => ({
      id: a.id,
      kind: a.kind,
      name: a.name,
      network: a.network,
      hash: a.hash,
      metadata: a.metadata,
      createdAt: a.createdAt,
    }));

    this.events.emit(WORKSPACE_EXPORTED, { workspaceId: id, ownerKey });
    void this.audit.log({
      actor: ownerKey,
      action: "workspace.exported_zip",
      resourceType: "workspace",
      resourceId: id,
    });

    const archive = new ZipArchive({ zlib: { level: 9 } });
    const stream = new PassThrough();

    archive.pipe(stream);

    archive.append(JSON.stringify(snapshot, null, 2), { name: "workspace.json" });
    archive.append(JSON.stringify(contracts, null, 2), { name: "contracts.json" });
    archive.append(JSON.stringify(interactions, null, 2), { name: "interactions.json" });
    archive.append(JSON.stringify(artifacts, null, 2), { name: "artifacts.json" });

    archive.finalize();

    return stream;
  }

  @MapDbErrors()
  async replayInteraction(id: string, interactionId: string, ownerKey: string) {
    const workspace = await this.repository.findFirst({
      where: { id, ownerKey },
      include: { savedInteractions: true },
    });

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    const interaction = workspace.savedInteractions.find((i) => i.id === interactionId);
    if (!interaction) {
      throw new NotFoundException("Interaction not found");
    }

    return {
      interactionId: interaction.id,
      functionName: interaction.functionName,
      network: interaction.network,
      contractId: interaction.contractId,
      argumentsJson: interaction.argumentsJson,
      createdAt: interaction.createdAt,
    };
  }

  @MapDbErrors()
  async diffInteractions(
    id: string,
    interactionId: string,
    compareId: string,
    ownerKey: string,
  ) {
    const workspace = await this.repository.findFirst({
      where: { id, ownerKey },
      include: { savedInteractions: true },
    });

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    const a = workspace.savedInteractions.find((i) => i.id === interactionId);
    const b = workspace.savedInteractions.find((i) => i.id === compareId);

    if (!a) throw new NotFoundException(`Interaction ${interactionId} not found`);
    if (!b) throw new NotFoundException(`Interaction ${compareId} not found`);

    const argsA = (a.argumentsJson as Record<string, unknown>) ?? {};
    const argsB = (b.argumentsJson as Record<string, unknown>) ?? {};

    const allKeys = new Set([...Object.keys(argsA), ...Object.keys(argsB)]);

    const changed: Record<string, { from: unknown; to: unknown }> = {};
    const added: Record<string, unknown> = {};
    const removed: Record<string, unknown> = {};

    for (const key of allKeys) {
      const inA = key in argsA;
      const inB = key in argsB;

      if (inA && inB) {
        const valA = JSON.stringify(argsA[key]);
        const valB = JSON.stringify(argsB[key]);
        if (valA !== valB) {
          changed[key] = { from: argsA[key], to: argsB[key] };
        }
      } else if (inA && !inB) {
        removed[key] = argsA[key];
      } else {
        added[key] = argsB[key];
      }
    }

    return {
      interactionA: { id: a.id, functionName: a.functionName },
      interactionB: { id: b.id, functionName: b.functionName },
      changed,
      added,
      removed,
      identical: Object.keys(changed).length === 0 && Object.keys(added).length === 0 && Object.keys(removed).length === 0,
    };
  }
}
