/**
 * AI-924: Draft release notes from merged work.
 */

import { Injectable, NotFoundException } from "@nestjs/common";
import { IsString, IsArray } from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";

export const RELEASE_NOTES_MODEL_VERSION = "rules-v1.0.0" as const;

export interface MergedEntry {
  prNumber: number;
  title: string;
  author: string;
  labels?: string[];
}

export interface ReleaseSection {
  heading: string;
  entries: string[];
}

export class DraftReleaseNotesDto {
  @IsString()
  releaseId!: string;

  @IsString()
  version!: string;

  @IsArray()
  mergedEntries!: MergedEntry[];
}

const LABEL_CATEGORY_MAP: Record<string, string> = {
  "feat": "New Features",
  "feature": "New Features",
  "fix": "Bug Fixes",
  "bugfix": "Bug Fixes",
  "docs": "Documentation",
  "chore": "Maintenance",
  "refactor": "Maintenance",
  "test": "Tests",
  "perf": "Performance",
};

const TITLE_KEYWORDS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /^feat[:!]/i, category: "New Features" },
  { pattern: /^fix[:!]/i, category: "Bug Fixes" },
  { pattern: /^docs[:!]/i, category: "Documentation" },
  { pattern: /^test[:!]/i, category: "Tests" },
  { pattern: /^perf[:!]/i, category: "Performance" },
  { pattern: /^chore[:!]|^refactor[:!]/i, category: "Maintenance" },
];

function categorize(entry: MergedEntry): string {
  for (const label of entry.labels ?? []) {
    const cat = LABEL_CATEGORY_MAP[label.toLowerCase()];
    if (cat) return cat;
  }
  for (const rule of TITLE_KEYWORDS) {
    if (rule.pattern.test(entry.title.trim())) return rule.category;
  }
  return "Other Changes";
}

function buildSections(entries: MergedEntry[]): ReleaseSection[] {
  const sectionMap = new Map<string, string[]>();
  for (const entry of entries) {
    const category = categorize(entry);
    const line = `- ${entry.title} (#${entry.prNumber}) by @${entry.author}`;
    (sectionMap.get(category) ?? sectionMap.set(category, []).get(category)!).push(line);
  }
  return [...sectionMap.entries()].map(([heading, lines]) => ({ heading, entries: lines }));
}

function buildNotes(version: string, sections: ReleaseSection[]): string {
  const lines = [`## ${version}`, ""];
  for (const section of sections) {
    lines.push(`### ${section.heading}`);
    lines.push(...section.entries);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

@Injectable()
export class ReleaseNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async draft(dto: DraftReleaseNotesDto, actorKey: string) {
    const sections = buildSections(dto.mergedEntries);
    const notesText = buildNotes(dto.version, sections);

    const record = await this.prisma.releaseNotesDraft.upsert({
      where: { releaseId: dto.releaseId },
      create: {
        releaseId: dto.releaseId,
        version: dto.version,
        sections: sections as unknown as Prisma.InputJsonValue,
        notesText,
        entryCount: dto.mergedEntries.length,
        modelVersion: RELEASE_NOTES_MODEL_VERSION,
      },
      update: {
        version: dto.version,
        sections: sections as unknown as Prisma.InputJsonValue,
        notesText,
        entryCount: dto.mergedEntries.length,
        modelVersion: RELEASE_NOTES_MODEL_VERSION,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "release.notes.drafted",
      resourceType: "release_notes_draft",
      resourceId: record.id,
      summary: `Release ${dto.version} (${dto.releaseId}): ${dto.mergedEntries.length} entries in ${sections.length} section(s)`,
      metadata: { modelVersion: RELEASE_NOTES_MODEL_VERSION, entryCount: dto.mergedEntries.length } as Prisma.InputJsonValue,
    });

    return record;
  }

  @MapDbErrors()
  async getByRelease(releaseId: string) {
    const record = await this.prisma.releaseNotesDraft.findUnique({ where: { releaseId } });
    if (!record) throw new NotFoundException("No release notes draft found for this release");
    return record;
  }

  @MapDbErrors()
  async list() {
    return this.prisma.releaseNotesDraft.findMany({ orderBy: { createdAt: "desc" } });
  }
}
