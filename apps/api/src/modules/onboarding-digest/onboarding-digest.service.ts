/**
 * AI-932: Generate onboarding digests for newcomers.
 */

import { Injectable, NotFoundException } from "@nestjs/common";
import { IsString, IsOptional, IsArray } from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";

export const ONBOARDING_DIGEST_MODEL_VERSION = "rules-v1.0.0" as const;

export interface DigestSection {
  heading: string;
  items: string[];
}

export class GenerateOnboardingDigestDto {
  @IsString()
  contributorKey!: string;

  @IsOptional()
  @IsArray()
  completedSteps?: string[];

  @IsOptional()
  @IsString()
  focusArea?: string;
}

const ONBOARDING_TRACK: DigestSection[] = [
  {
    heading: "First Steps",
    items: [
      "Fork the repository from https://github.com/Ibinola/soroban-dev-console",
      "Clone your fork: `git clone https://github.com/<your-fork>/soroban-dev-console`",
      "Install dependencies: `npm install`",
      "Copy environment files: `cp apps/api/.env.example apps/api/.env`",
      "Initialize the database: `cd apps/api && npx prisma db push`",
    ],
  },
  {
    heading: "Running the Project",
    items: [
      "Start the API: `npm run dev -w api` (runs on port 4000)",
      "Start the web app: `npm run dev -w web` (runs on port 3000)",
      "Visit http://localhost:3000 to see the app",
    ],
  },
  {
    heading: "Finding Your First Task",
    items: [
      "Browse open issues on GitHub and look for issues assigned to you",
      "Create a branch: `git checkout -b fix/issue-<number>-<short-description>`",
      "Read CONTRIBUTING.md for workflow guidelines",
    ],
  },
  {
    heading: "Submitting Work",
    items: [
      "Run lint before committing: `npm run lint -w api`",
      "Run type check: `npm run typecheck -w api`",
      "Push your branch and open a PR to `Ibinola/soroban-dev-console`",
      "PR title should be under 70 characters and reference the issue",
    ],
  },
  {
    heading: "Key Docs",
    items: [
      "README.md — Architecture, tech stack, quickstart",
      "CONTRIBUTING.md — Contribution workflow",
      "apps/api/src/modules/ — NestJS API modules",
      "apps/api/prisma/schema.prisma — Database schema",
    ],
  },
];

function buildDigest(completedSteps: string[], focusArea?: string): { sections: DigestSection[]; digestText: string } {
  const completed = new Set(completedSteps.map((s) => s.toLowerCase()));

  const sections = ONBOARDING_TRACK.map((section) => ({
    heading: section.heading,
    items: section.items.filter((item) => !completed.has(item.toLowerCase())),
  })).filter((s) => s.items.length > 0);

  const filtered = focusArea
    ? sections.filter((s) => s.heading.toLowerCase().includes(focusArea.toLowerCase()) || true)
    : sections;

  const lines: string[] = ["# Onboarding Digest", ""];
  for (const section of filtered) {
    lines.push(`## ${section.heading}`);
    for (const item of section.items) lines.push(`- ${item}`);
    lines.push("");
  }

  return { sections: filtered, digestText: lines.join("\n").trimEnd() };
}

@Injectable()
export class OnboardingDigestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async generate(dto: GenerateOnboardingDigestDto, actorKey: string) {
    const { sections, digestText } = buildDigest(dto.completedSteps ?? [], dto.focusArea);

    const record = await this.prisma.onboardingDigest.upsert({
      where: { contributorKey: dto.contributorKey },
      create: {
        contributorKey: dto.contributorKey,
        sections: sections as unknown as Prisma.InputJsonValue,
        digestText,
        modelVersion: ONBOARDING_DIGEST_MODEL_VERSION,
      },
      update: {
        sections: sections as unknown as Prisma.InputJsonValue,
        digestText,
        modelVersion: ONBOARDING_DIGEST_MODEL_VERSION,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "onboarding.digest.generated",
      resourceType: "onboarding_digest",
      resourceId: record.id,
      summary: `Onboarding digest for ${dto.contributorKey}: ${sections.length} section(s)`,
      metadata: { modelVersion: ONBOARDING_DIGEST_MODEL_VERSION } as Prisma.InputJsonValue,
    });

    return record;
  }

  @MapDbErrors()
  async getByContributor(contributorKey: string) {
    const record = await this.prisma.onboardingDigest.findUnique({ where: { contributorKey } });
    if (!record) throw new NotFoundException("No onboarding digest found for this contributor");
    return record;
  }

  @MapDbErrors()
  async list() {
    return this.prisma.onboardingDigest.findMany({ orderBy: { createdAt: "desc" } });
  }
}
