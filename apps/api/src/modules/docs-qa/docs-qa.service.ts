/**
 * AI-926: Build a docs Q&A assistant.
 */

import { Injectable, NotFoundException } from "@nestjs/common";
import { IsString, IsOptional } from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../lib/prisma.service.js";
import { AuditService } from "../../lib/audit.service.js";
import { MapDbErrors } from "../../lib/db-error.mapper.js";

export const DOCS_QA_MODEL_VERSION = "rules-v1.0.0" as const;

export interface DocSource {
  path: string;
  relevanceScore: number;
  excerpt: string;
}

export class AskDocsDto {
  @IsString()
  questionId!: string;

  @IsString()
  question!: string;

  @IsOptional()
  @IsString()
  scope?: string;
}

const DOC_CATALOG: Array<{ paths: string[]; keywords: string[]; excerpt: string }> = [
  {
    paths: ["README.md", "docs/overview.md"],
    keywords: ["overview", "architecture", "stack", "started", "install", "setup", "quickstart"],
    excerpt: "See README.md for architecture overview, tech stack, and quickstart instructions.",
  },
  {
    paths: ["CONTRIBUTING.md"],
    keywords: ["contribute", "pr", "pull request", "branch", "fork", "workflow", "commit"],
    excerpt: "See CONTRIBUTING.md for the contribution workflow, branch naming, and PR guidelines.",
  },
  {
    paths: ["apps/api/src/modules/", "apps/api/README.md"],
    keywords: ["api", "module", "service", "controller", "nest", "backend", "endpoint"],
    excerpt: "The NestJS API lives in apps/api/src/modules/. Each feature is a self-contained module.",
  },
  {
    paths: ["apps/api/prisma/schema.prisma"],
    keywords: ["database", "prisma", "schema", "migration", "model", "table", "sqlite"],
    excerpt: "The Prisma schema is at apps/api/prisma/schema.prisma. Run `npx prisma db push` after changes.",
  },
  {
    paths: ["apps/web/"],
    keywords: ["frontend", "web", "react", "nextjs", "ui", "component", "page"],
    excerpt: "The Next.js frontend lives in apps/web/. Pages use the App Router under apps/web/app/.",
  },
  {
    paths: ["packages/api-contracts/src/runtime-defaults.ts"],
    keywords: ["port", "url", "default", "env", "runtime", "config", "drift"],
    excerpt: "Runtime defaults (ports, URLs) are centralized in packages/api-contracts/src/runtime-defaults.ts.",
  },
];

function searchDocs(question: string): { answer: string; sources: DocSource[]; confidence: number } {
  const lower = question.toLowerCase();
  const terms = lower.split(/\s+/).filter((t) => t.length > 2);

  const scored = DOC_CATALOG.map((doc) => {
    const hits = doc.keywords.filter((kw) => terms.some((t) => t.includes(kw) || kw.includes(t)));
    return { doc, score: hits.length / Math.max(terms.length, 1) };
  }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      answer: "No matching documentation found for this question. Try rephrasing or consult README.md.",
      sources: [],
      confidence: 0,
    };
  }

  const topMatches = scored.slice(0, 3);
  const sources: DocSource[] = topMatches.flatMap(({ doc, score }) =>
    doc.paths.map((path) => ({ path, relevanceScore: Math.round(score * 1000) / 1000, excerpt: doc.excerpt }))
  );

  const answer = topMatches.map(({ doc }) => doc.excerpt).join(" | ");
  const confidence = topMatches[0].score;

  return { answer, sources, confidence: Math.round(confidence * 1000) / 1000 };
}

@Injectable()
export class DocsQaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @MapDbErrors()
  async ask(dto: AskDocsDto, actorKey: string) {
    const { answer, sources, confidence } = searchDocs(dto.question);

    const record = await this.prisma.docsQaAnswer.upsert({
      where: { questionId: dto.questionId },
      create: {
        questionId: dto.questionId,
        question: dto.question,
        answer,
        sources: sources as unknown as Prisma.InputJsonValue,
        confidence,
        modelVersion: DOCS_QA_MODEL_VERSION,
      },
      update: {
        question: dto.question,
        answer,
        sources: sources as unknown as Prisma.InputJsonValue,
        confidence,
        modelVersion: DOCS_QA_MODEL_VERSION,
      },
    });

    void this.audit.log({
      actor: actorKey,
      action: "docs.qa.answered",
      resourceType: "docs_qa_answer",
      resourceId: record.id,
      summary: `Question ${dto.questionId}: confidence=${confidence}, sources=${sources.length}`,
      metadata: { modelVersion: DOCS_QA_MODEL_VERSION, confidence } as Prisma.InputJsonValue,
    });

    return record;
  }

  @MapDbErrors()
  async getByQuestion(questionId: string) {
    const record = await this.prisma.docsQaAnswer.findUnique({ where: { questionId } });
    if (!record) throw new NotFoundException("No answer found for this question");
    return record;
  }

  @MapDbErrors()
  async list() {
    return this.prisma.docsQaAnswer.findMany({ orderBy: { createdAt: "desc" } });
  }
}
