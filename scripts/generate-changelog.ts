#!/usr/bin/env tsx
/**
 * W7-DEVOPS-003 (#659): Keep a Changelog generator.
 *
 * Walks `git log --merges` for a date range, parses PR titles, and emits a
 * markdown changelog grouped by conventional-commit category (Added /
 * Changed / Fixed / Security / Removed / Deprecated).
 *
 * Usage:
 *   npx tsx scripts/generate-changelog.ts --since 2026-07-01
 *   npx tsx scripts/generate-changelog.ts --since 2026-07-01 --until 2026-07-23
 *   npx tsx scripts/generate-changelog.ts --since 2026-07-01 --out CHANGELOG.fragment.md
 *   npx tsx scripts/generate-changelog.ts --since 2026-07-01 --base origin/main
 *
 * Exit codes:
 *   0 — at least one merged PR found, output written
 *   1 — no merged PRs found in the given range (treated as failure so CI
 *       can detect stale generated fragments)
 *   2 — bad arguments
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// PR title format we expect: "<type>(<scope>): <description> (#NNN)"
// Pull request merge commits look like: "Merge pull request #NNN from <branch>"
// Combined we know the body of the merged commit (= original PR subject).
type Group =
  | "Added"
  | "Changed"
  | "Fixed"
  | "Removed"
  | "Deprecated"
  | "Security";

interface Parsed {
  type: string;
  scope: string | null;
  description: string;
  prNumber: number | null;
}

interface Entry {
  group: Group;
  text: string;
  prNumber: number | null;
}

interface CliOptions {
  since: string | null;
  until: string | null;
  base: string;
  out: string | null;
  releaseHeader: string;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    since: null,
    until: null,
    base: "origin/main",
    out: null,
    releaseHeader: "Unreleased",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--since" && next) {
      opts.since = next;
      i++;
    } else if (arg === "--until" && next) {
      opts.until = next;
      i++;
    } else if (arg === "--base" && next) {
      opts.base = next;
      i++;
    } else if (arg === "--out" && next) {
      opts.out = next;
      i++;
    } else if (arg === "--release" && next) {
      opts.releaseHeader = next;
      i++;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return opts;
}

function printHelp(): void {
  console.log(`Usage: npm run generate-changelog -- [options]

Options:
  --since <date>        ISO date (YYYY-MM-DD) lower bound (required)
  --until <date>        ISO date (YYYY-MM-DD) upper bound (defaults to today)
  --base <ref>          Git base ref to resolve from (default: origin/main)
  --out <path>          Write markdown to a file instead of stdout
  --release <label>     Section heading (default: "Unreleased")
  -h, --help            Show this message
`);
}

function validateDate(label: string, value: string | null): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    console.error(
      `❌ --${label} must be an ISO date (YYYY-MM-DD): got "${value}"`,
    );
    process.exit(2);
  }
  return value;
}

function parseSubject(subject: string): Parsed | null {
  // Conventional-commit-ish: "type(scope)?: description (#PR)"
  // Some waves add a "Wave N:" prefix; tolerate either form.
  const cleaned = subject
    .replace(/^Wave\s+\d+:\s*/i, "")
    .replace(/^\[[^\]]+\]\s*/, "")
    .trim();

  const conventional =
    /^([a-zA-Z]+)(?:\(([^)]+)\))?(!)?:\s*(.+?)(?:\s+\(#(\d+)\))?$/;
  const match = cleaned.match(conventional);
  if (!match) {
    // Fall back to plain titles so pre-conventional commits still appear.
    const prMatch = cleaned.match(/\(#(\d+)\)/);
    return {
      type: "other",
      scope: null,
      description: cleaned,
      prNumber: prMatch ? Number(prMatch[1]) : null,
    };
  }
  return {
    type: match[1].toLowerCase(),
    scope: match[2] ?? null,
    description: match[4].trim(),
    prNumber: match[5] ? Number(match[5]) : null,
  };
}

function categorize(type: string): Group {
  switch (type) {
    case "feat":
      return "Added";
    case "fix":
      return "Fixed";
    case "refactor":
    case "perf":
    case "style":
    case "dx":
    case "docs":
      return "Changed";
    case "chore":
    case "build":
    case "ci":
    case "test":
    case "tests":
      return "Changed";
    case "remove":
    case "removed":
      return "Removed";
    case "deprecate":
    case "deprecated":
      return "Deprecated";
    case "security":
      return "Security";
    default:
      return "Changed";
  }
}

interface MergeRecord {
  sha: string;
  subject: string;
}

function readMergedPRs(opts: CliOptions): MergeRecord[] {
  const args = ["log", "--merges", "--first-parent", `--pretty=%H|%s`];
  if (opts.base) {
    args.push(opts.base);
    args.push("..HEAD");
  }
  if (opts.since) args.push(`--since=${opts.since}`);
  if (opts.until) args.push(`--until=${opts.until}`);

  let raw: string;
  try {
    raw = execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      // Using execFileSync avoids the shell interpreting characters like
      // '|' in `--pretty=%H|%s` as a pipe operator.
    });
  } catch (err) {
    console.error(
      `❌ git log failed: ${(err as Error).message}\n   Make sure "${opts.base}" is fetched (e.g. "git fetch origin ${opts.base.split("/").pop()}").`,
    );
    process.exit(2);
  }

  return raw
    .split("\n")
    .filter((line) => line.includes("|"))
    .map((line) => {
      const [sha, subject] = line.split("|", 2);
      return { sha, subject };
    });
}

function buildEntries(records: MergeRecord[]): Entry[] {
  const entries: Entry[] = [];
  for (const { subject } of records) {
    const lower = subject.toLowerCase();
    if (
      // Skip pure merge bubbles we don't want in a changelog
      lower.startsWith("merge branch") ||
      lower.startsWith("merge remote-tracking") ||
      lower.startsWith("merge tag ")
    ) {
      continue;
    }
    const parsed = parseSubject(subject);
    if (!parsed) continue;
    const group = categorize(parsed.type);
    const prSuffix = parsed.prNumber ? ` (#${parsed.prNumber})` : "";
    const scopeTag = parsed.scope ? `**${parsed.scope}** — ` : "";
    entries.push({
      group,
      text: `- ${scopeTag}${parsed.description}${prSuffix}`,
      prNumber: parsed.prNumber,
    });
  }
  // Stable ordering: by group then by PR number (when present), else text.
  const groupOrder: Group[] = [
    "Security",
    "Added",
    "Changed",
    "Fixed",
    "Deprecated",
    "Removed",
  ];
  entries.sort((a, b) => {
    const g = groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group);
    if (g !== 0) return g;
    if (a.prNumber !== null && b.prNumber !== null)
      return a.prNumber - b.prNumber;
    return a.text.localeCompare(b.text);
  });
  return entries;
}

function renderMarkdown(opts: CliOptions, entries: Entry[]): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [`## [${opts.releaseHeader}] — ${date}`, ""];
  const byGroup = entries.reduce<Record<Group, Entry[]>>(
    (acc, e) => {
      acc[e.group].push(e);
      return acc;
    },
    {
      Security: [],
      Added: [],
      Changed: [],
      Fixed: [],
      Deprecated: [],
      Removed: [],
    },
  );
  for (const group of [
    "Security",
    "Added",
    "Changed",
    "Fixed",
    "Deprecated",
    "Removed",
  ] as Group[]) {
    if (byGroup[group].length === 0) continue;
    lines.push(`### ${group}`, "");
    lines.push(...byGroup[group].map((e) => e.text));
    lines.push("");
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  opts.since = validateDate("since", opts.since);
  opts.until = validateDate("until", opts.until);

  if (!opts.since) {
    console.error("❌ --since is required.");
    printHelp();
    process.exit(2);
  }

  const records = readMergedPRs(opts);
  if (records.length === 0) {
    console.error(
      `❌ No merged PRs found between ${opts.since}${opts.until ? ` and ${opts.until}` : ""} on top of ${opts.base}.`,
    );
    console.error(`   Tip: try a wider range or fetch "${opts.base}" first.`);
    process.exit(1);
  }

  const entries = buildEntries(records);
  const markdown = renderMarkdown(opts, entries);

  if (opts.out) {
    const outPath = path.isAbsolute(opts.out)
      ? opts.out
      : path.join(ROOT, opts.out);
    fs.writeFileSync(outPath, markdown, "utf-8");
    console.log(
      `✅ Generated ${entries.length} entries → ${path.relative(ROOT, outPath)}`,
    );
  } else {
    process.stdout.write(markdown);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ generate-changelog failed:", err);
  process.exit(2);
});
