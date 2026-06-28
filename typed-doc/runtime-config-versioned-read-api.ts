/**
 * Issue #499 (BE-330): Model runtime config as a versioned read API
 *
 * Root cause:
 * - RuntimeConfigController exposes GET /runtime-config which always
 *   returns the latest computed config (current version only)
 * - There is no version query parameter, version history retrieval,
 *   or diff endpoint to compare config versions
 * - RuntimeConfigService caches only the latest config in-memory but
 *   has no persistence layer for historical versions, making rollback
 *   and audit comparison impossible
 *
 * Fix: Introduce a versioned read API backed by a config_snapshots
 *       table in Prisma, supporting ?version=N queries, version
 *       listing, and version diffing.
 */

// ---- Prisma schema addition ----
model ConfigSnapshot {
  id        String   @id @default(cuid())
  version   Int
  profile   String
  config    Json              // full RuntimeConfig payload
  hash      String            // configHash for integrity verification
  createdBy String   @map("created_by")
  createdAt DateTime @default(now()) @map("created_at")

  @@unique([version])
  @@index([profile, version])
  @@map("config_snapshots")
}

// ---- FIXED runtime-config.controller.ts ----
@Controller("runtime-config")
export class RuntimeConfigController {
  constructor(private readonly service: RuntimeConfigService) {}

  @Get()
  get(@Query("version") version?: string) {
    if (version) {
      return this.service.getVersion(parseInt(version, 10));
    }
    return this.service.getConfig();
  }

  @Get("versions")
  listVersions(@Query("profile") profile?: string) {
    return this.service.listVersions(profile);
  }

  @Get("diff")
  diff(@Query("from") from: string, @Query("to") to: string) {
    return this.service.diffVersions(parseInt(from, 10), parseInt(to, 10));
  }

  @Get("health")
  health() {
    return this.service.getLastDistribution();
  }

  @Post("redistribute")
  redistribute() {
    return this.service.redistribute();
  }
}

// ---- FIXED runtime-config.service.ts additions ----
@Injectable()
export class RuntimeConfigService {
  constructor(
    private readonly config: ConfigService,
    private readonly audit?: AuditService,
    private readonly prisma?: PrismaService,  // new
  ) {}

  async getConfig(): Promise<RuntimeConfig> {
    const config = this.buildConfig();

    // Persist a snapshot if the hash differs from the latest
    if (this.prisma) {
      const latest = await this.prisma.configSnapshot.findFirst({
        orderBy: { version: "desc" },
      });
      if (!latest || latest.hash !== config.configHash) {
        const nextVersion = (latest?.version ?? 0) + 1;
        await this.prisma.configSnapshot.create({
          data: {
            version: nextVersion,
            profile: config.profile,
            config: config as any,
            hash: config.configHash,
            createdBy: "system:runtime-config",
          },
        });
      }
    }

    this.cachedConfig = config;
    this.lastDistribution = new Date();
    void this.audit?.log({ ... });
    return config;
  }

  async getVersion(version: number): Promise<RuntimeConfig | null> {
    if (!this.prisma) return null;
    const snapshot = await this.prisma.configSnapshot.findUnique({
      where: { version },
    });
    return snapshot?.config as RuntimeConfig ?? null;
  }

  async listVersions(profile?: string) {
    if (!this.prisma) return [];
    return this.prisma.configSnapshot.findMany({
      where: profile ? { profile } : undefined,
      orderBy: { version: "desc" },
      select: { version: true, profile: true, hash: true, createdAt: true, createdBy: true },
    });
  }

  async diffVersions(from: number, to: number) {
    const [a, b] = await Promise.all([
      this.getVersion(from),
      this.getVersion(to),
    ]);
    if (!a || !b) throw new NotFoundException("Config version not found");
    // Compute structural diff between a and b
    return { from: a, to: b, changes: this.computeDiff(a, b) };
  }

  private computeDiff(a: RuntimeConfig, b: RuntimeConfig): Record<string, { from: unknown; to: unknown }> {
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(a) as Array<keyof RuntimeConfig>) {
      if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
        changes[key] = { from: a[key], to: b[key] };
      }
    }
    return changes;
  }
}
