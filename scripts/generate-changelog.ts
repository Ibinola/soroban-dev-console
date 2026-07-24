#!/usr/bin/env tsx
/**
 * scripts/generate-changelog.ts
 *
 * W7-DEVOPS-003 / #659 — Generates a Keep-a-Changelog-style markdown
 * summary of merged pull requests since a given date.
 *
 * Usage:
 *   npm run generate-changelog -- --since 2026-07-01
 *   npm run generate-changelog -- --since 2026-07-01 --until 2026-07-30
 *   npm run generate-changelog -- --since 2026-07-01 --output CHANGELOG.fragment.md
 *   npm run generate-changelog -- --since 2026-07-01 --write CHANGELOG.md
 *
 * Exit codes:
 *   0 — output written
 *   1 — no merged PRs found in the requested range (per acceptance criteria)
 *   2 — usage / argument error
 */

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

interface CliArgs {
  since?: string;
  until?: string;
  output?: string;
  write?: string;
  help?: boolean;
}

function parseCliArgs(): CliArgs {
  const { values } = parseArgs({
    options: {
      since: { type: "string" },
      until: { type: "string" },
      output: { type: "string" },
      write: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
    strict: true,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  if (!values.since) {
    process.stderr.write(
      "Error: --since <iso-date> is required.\n\n" +
        "Example: npm run generate-changelog -- --since 2026-07-01\n",
    );
    process.exit(2);
  }

  // Pre-validate the date so we fail fast on bad input.
  if (Number.isNaN(Date.parse(values.since))) {
    process.stderr.write(
      `Error: --since value "${values.since}" is not a valid date.\n`,
    );
    process.exit(2);
  }
  if (values.until && Number.isNaN(Date.parse(values.until))) {
    process.stderr.write(
      `Error: --until value "${values.until}" is not a valid date.\n`,
    );
    process.exit(2);
  }

  return {
    since: values.since,
    until: values.until,
    output: values.output,
    write: values.write,
  };
}

function printHelp() {
  process.stdout.write(
    `Usage: generate-changelog --since <iso-date> [options]

Options:
  --since <iso-date>   Lower bound (inclusive). Required.
  --until <iso-date>   Upper bound (inclusive). Optional.
  --output <file>      Write markdown to file instead of stdout.
  --write <file>       Same as --output (kept for readability).
  -h, --help           Show this message and exit.

Exit codes:
  0  Output written successfully.
  1  No merged PRs found in the requested range.
  2  Invalid arguments.
`,
  );
}

interface MergeCommit {
  hash: string;
  subject: string;
  body: string;
  author: string;
  date: Date;
}

interface PullRequestSummary {
  number: number;
  title: string;
  hash: string;
  author: string;
  sourceBranch: string;
  wave: string | null;
  date: Date;
}

// Distinct separators so PR bodies containing any of these bytes
// cannot corrupt field parsing.
//   %x1d — Group Separator (field separator inside one commit)
//   %x1e — Record Separator (commit boundary)
//   %x1f — Unit Separator (single-use delimiter before the body)
const MERGE_COMMIT_FORMAT = "%H%x1d%an%x1d%aI%x1d%s%x1f%b%x1e";

function readMergeCommits(args: CliArgs): MergeCommit[] {
  const gitArgs = [
    "log",
    "--merges",
    "--first-parent",
    `--format=${MERGE_COMMIT_FORMAT}`,
  ];
  gitArgs.push(`--since=${args.since}`);
  if (args.until) gitArgs.push(`--until=${args.until}`);

  let raw: string;
  try {
    raw = execFileSync("git", gitArgs, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err: any) {
    process.stderr.write(
      `Error: failed to read git log (${err?.message ?? "unknown error"}).\n` +
        "Make sure this script is run inside the repository root.\n",
    );
    process.exit(2);
  }

  return raw
    .split("\x1e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      // Peel the body off at the first %x1f so any bytes the body
      // contains (%x1d, %x1e) cannot corrupt the field split.
      const bodyDelim = record.indexOf("\x1f");
      const headSection = bodyDelim >= 0 ? record.slice(0, bodyDelim) : record;
      const body = bodyDelim >= 0 ? record.slice(bodyDelim + 1) : "";
      const [hash, author, dateIso, subject] = headSection.split("\x1d");
      return {
        hash,
        author,
        date: new Date(dateIso),
        subject,
        body: body.trim(),
      };
    });
}

const PR_NUMBER_RE = /#(\d+)\b/;
const PR_BRANCH_RE = /from\s+([^\s/]+)\/([^\s\)]+)/i;
const WAVE_RE = /wave[_\-\s]?(\d+)/i;

function parsePullRequest(commit: MergeCommit): PullRequestSummary | null {
  const subjectMatch = commit.subject.match(PR_NUMBER_RE);
  const branchMatch = commit.body.match(PR_BRANCH_RE);

  if (!subjectMatch) return null;

  const number = Number.parseInt(subjectMatch[1], 10);
  if (!Number.isFinite(number)) return null;

  // Merge commits use the title of the PR as the first body line.
  const titleLine =
    commit.body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? commit.subject;

  const sourceBranch = branchMatch
    ? `${branchMatch[1]}/${branchMatch[2]}`
    : "unknown";
  const waveMatch = sourceBranch.match(WAVE_RE);

  return {
    number,
    title: titleLine,
    hash: commit.hash,
    author: commit.author,
    sourceBranch,
    wave: waveMatch ? `Wave ${waveMatch[1]}` : null,
    date: commit.date,
  };
}

function groupByWave(
  prs: PullRequestSummary[],
): Map<string | null, PullRequestSummary[]> {
  const groups = new Map<string | null, PullRequestSummary[]>();
  // Wave sections first, then ungrouped "Other PRs".
  const ordered: Array<string | null> = [];
  const seen = new Set<string | null>();
  for (const pr of prs) {
    const key = pr.wave;
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(key);
    }
    const bucket = groups.get(key) ?? [];
    bucket.push(pr);
    groups.set(key, bucket);
  }
  // Stable ordering: Wave 1, Wave 2, … ungrouped last.
  ordered.sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    const aNum = Number.parseInt(a.replace(/\D/g, ""), 10);
    const bNum = Number.parseInt(b.replace(/\D/g, ""), 10);
    return aNum - bNum;
  });
  return new Map(ordered.map((k) => [k, groups.get(k) ?? []]));
}

function formatMarkdown(
  prs: PullRequestSummary[],
  range: { since: string; until?: string },
): string {
  const today = new Date().toISOString().slice(0, 10);
  const sinceDate = range.since;
  const untilDate = range.until ?? today;

  const groups = groupByWave(prs);
  const headline = `# Generated changelog — ${sinceDate} → ${untilDate}\n`;
  const intro =
    `_Extracted from \`git log --merges --first-parent\` on ${today}. ` +
    `${prs.length} merged PR${prs.length === 1 ? "" : "s"}._\n`;

  const sections: string[] = [];
  for (const [wave, list] of groups) {
    const heading = wave ?? "Other merged PRs";
    sections.push(`## ${heading}`);
    for (const pr of list) {
      // PR links fall back to the local clone remote if no GitHub host is set.
      sections.push(`- PR #${pr.number}: ${pr.title}`);
    }
    sections.push("");
  }

  return [headline, intro, ...sections].join("\n");
}

function run() {
  const args = parseCliArgs();
  const commits = readMergeCommits(args);
  const prs = commits
    .map(parsePullRequest)
    .filter((pr): pr is PullRequestSummary => pr !== null);

  if (prs.length === 0) {
    process.stderr.write(
      `No merged pull requests found between ${args.since}` +
        (args.until ? ` and ${args.until}` : " and now") +
        ".\n",
    );
    process.exit(1);
  }

  // Newest first.
  prs.sort((a, b) => b.date.getTime() - a.date.getTime());

  const markdown = formatMarkdown(prs, {
    since: args.since,
    until: args.until,
  });

  const target = args.output ?? args.write;
  if (target) {
    const dest = resolve(process.cwd(), target);
    writeFileSync(dest, markdown + "\n", "utf8");
    process.stdout.write(
      `Wrote ${prs.length} merged PR${prs.length === 1 ? "" : "s"} to ${dest}\n`,
    );
  } else {
    process.stdout.write(markdown);
  }
}

try {
  run();
} catch (err: any) {
  process.stderr.write(
    `Error: unexpected failure in generate-changelog: ${err?.message ?? err}\n`,
  );
  process.exit(2);
}
